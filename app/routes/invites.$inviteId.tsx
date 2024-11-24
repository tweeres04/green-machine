import { json, LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { Button } from '~/components/ui/button'
import Nav from '~/components/ui/nav'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { commitSession, getSession } from '~/lib/session.server'
import { useMixpanelIdentify } from '~/lib/useMixpanelIdentify'
import { userInvites } from '~/schema'

export async function loader({ params, request }: LoaderFunctionArgs) {
	invariant(params.inviteId, 'Missing inviteId parameter')

	const db = getDb()

	const inviteId = Number(params.inviteId)

	const invite = await db.query.userInvites.findFirst({
		where: (userInvites, { eq }) => eq(userInvites.id, inviteId),
		with: {
			inviter: true,
			player: {
				with: {
					team: true,
				},
			},
		},
	})

	if (!invite) {
		throw new Response(null, { status: 404 })
	}

	const user = await authenticator.isAuthenticated(request)

	if (invite.userId === user?.id) {
		return json({ team: invite.player.team, inviterName: invite.inviter.name })
	}

	const token = new URL(request.url).searchParams.get('token')

	// todo token expiry
	if (!token || token !== invite.token) {
		throw new Response(null, { status: 401 })
	}

	if (!user) {
		const session = await getSession(request.headers.get('Cookie'))

		session.set('inviteId', inviteId)
		session.set('inviteToken', token)

		return redirect('/login', {
			headers: {
				'Set-Cookie': await commitSession(session),
			},
		})
	}

	await db
		.update(userInvites)
		.set({
			userId: user.id,
			acceptedAt: new Date().toISOString(),
		})
		.where(eq(userInvites.id, inviteId))

	return json({
		team: invite.player.team,
		inviterName: invite.inviter.name,
		user,
	})
}

export default function Invite() {
	const { inviterName, team, user } = useLoaderData<typeof loader>()

	useMixpanelIdentify(user)

	return (
		<>
			<Nav title="Invite" team={team} />
			<p>
				You've accepted {inviterName}'s invite to {team.name}!
			</p>
			<div className="text-center">
				<Button asChild variant="link">
					<Link to={`/${team.slug}`}>{team.name} home</Link>
				</Button>
			</div>
		</>
	)
}
