import { json, LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { formatISO } from 'date-fns'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { Button } from '~/components/ui/button'
import Nav from '~/components/ui/nav'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { commitSession, getSession } from '~/lib/session.server'
import { useMixpanelIdentify } from '~/lib/useMixpanelIdentify'
import { userInvites } from '~/schema'

// The invite props steer post-login redirects, so clear them once the
// invite is settled or every future login bounces through the stale invite
async function clearInviteSessionHeaders(request: Request) {
	const session = await getSession(request.headers.get('Cookie'))

	if (!session.has('inviteId') && !session.has('inviteToken')) {
		return undefined
	}

	session.unset('inviteId')
	session.unset('inviteToken')

	return { 'Set-Cookie': await commitSession(session) }
}

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
		return json(
			{ team: invite.player.team, inviterName: invite.inviter.name },
			{ headers: await clearInviteSessionHeaders(request) }
		)
	}

	const token = new URL(request.url).searchParams.get('token')

	// todo token expiry
	if (!token || token !== invite.token) {
		throw new Response(null, { status: 401 })
	}

	// An accepted invite belongs to its user: don't let it be re-accepted
	// (e.g. a second account logging in on the same browser after a stale
	// session redirect)
	if (invite.acceptedAt) {
		throw new Response('Invite already used', {
			status: 410,
			headers: await clearInviteSessionHeaders(request),
		})
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
			acceptedAt: formatISO(new Date()),
		})
		.where(eq(userInvites.id, inviteId))

	return json(
		{
			team: invite.player.team,
			inviterName: invite.inviter.name,
			user,
		},
		{ headers: await clearInviteSessionHeaders(request) }
	)
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
