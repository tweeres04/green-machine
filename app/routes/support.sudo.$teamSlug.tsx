import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import argon2 from 'argon2'
import invariant from 'tiny-invariant'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { mixpanelServer } from '~/lib/mixpanel.server'
import { slugEquals } from '~/lib/team-slug.server'
import {
	elevate,
	isSupportUser,
	SUDO_DURATION_MINUTES,
} from '~/lib/support.server'

async function requireSupportUser(request: Request) {
	const user = await authenticator.isAuthenticated(request)

	// 404 rather than 403: no reason to tell anyone this route exists
	if (!isSupportUser(user)) {
		throw new Response(null, { status: 404 })
	}

	invariant(user, 'isSupportUser is only true for a signed in user')

	return user
}

// By slug, so you can elevate straight from the URL you're already looking at
async function findTeam(teamSlug: string | undefined) {
	invariant(teamSlug, 'Missing teamSlug parameter')

	const db = getDb()
	const team = await db.query.teams.findFirst({
		where: () => slugEquals(teamSlug),
		columns: { id: true, name: true, slug: true },
	})

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	return team
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const [, team] = await Promise.all([
		requireSupportUser(request),
		findTeam(params.teamSlug),
	])

	// Through the loader rather than imported: pulling a constant out of
	// support.server would drag the whole server module into the client bundle
	return json({ team, sudoDurationMinutes: SUDO_DURATION_MINUTES })
}

export async function action({ request, params }: ActionFunctionArgs) {
	const [user, team, formData] = await Promise.all([
		requireSupportUser(request),
		findTeam(params.teamSlug),
		request.formData(),
	])

	const password = formData.get('password')

	if (typeof password !== 'string') {
		throw new Response('Invalid form', { status: 400 })
	}

	const db = getDb()

	// Read the hash fresh rather than trusting the copy carried in the session,
	// since the whole point is that a stolen session isn't enough
	const currentUser = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.id, user.id),
	})

	invariant(currentUser, 'Signed in user not found')

	if (!(await argon2.verify(currentUser.password, password))) {
		return json({ error: 'That password is wrong' }, { status: 401 })
	}

	elevate(user.id, team.id)

	mixpanelServer.track('support elevation', {
		distinct_id: user.id,
		'team id': team.id,
		'team name': team.name,
	})

	return redirect(`/${team.slug}`)
}

export default function SupportSudo() {
	const { team, sudoDurationMinutes } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	return (
		<div className="space-y-3">
			<h1 className="text-2xl">Support access</h1>
			<p>
				{`This gives you full edit access to ${team.name} for ${sudoDurationMinutes} minutes, then it expires on its own.`}
			</p>
			<Form method="post" className="space-y-3">
				<div>
					<label htmlFor="password_input">Your password</label>
					<Input
						type="password"
						name="password"
						id="password_input"
						autoComplete="current-password"
						required
					/>
				</div>
				{actionData?.error ? (
					<Alert variant="destructive">
						<AlertDescription>{actionData.error}</AlertDescription>
					</Alert>
				) : null}
				<Button>Elevate</Button>
			</Form>
		</div>
	)
}
