import { randomBytes } from 'node:crypto'
import { json, LoaderFunctionArgs, redirect } from '@remix-run/node'
import { formatISO } from 'date-fns'
import Mailgun from 'mailgun.js'
import invariant from 'tiny-invariant'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { commitSession, getSession } from '~/lib/session.server'
import { userInviteRequests } from '~/schema'
import Nav from '~/components/ui/nav'
import { useLoaderData } from '@remix-run/react'

async function sendInviteRequestEmail({
	teamId,
	requesterName,
	email,
	inviteRequestId,
	randomToken,
}: {
	teamId: number
	requesterName: string
	email: string
	inviteRequestId: number
	randomToken: string
}) {
	invariant(process.env.MAILGUN_API_KEY, 'No MAILGUN_API_KEY')
	invariant(process.env.MAILGUN_DOMAIN, 'No MAILGUN_DOMAIN')
	invariant(process.env.BASE_URL, 'No BASE_URL')

	const db = getDb()

	const teamRecord = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.id, teamId),
		columns: {
			name: true,
		},
	})

	invariant(teamRecord, 'Team not found')

	const teamName = teamRecord.name

	const mailgun = new Mailgun(FormData)
	const mg = mailgun.client({
		username: 'api',
		key: process.env.MAILGUN_API_KEY,
	})

	return mg.messages.create(process.env.MAILGUN_DOMAIN, {
		from: 'TeamStats Invite Request <invite_requests@teamstats.tweeres.com>',
		to: email,
		subject: `${requesterName} has requested to join ${teamName} on TeamStats`,
		text: `Accept their request here: ${process.env.BASE_URL}/invite-requests/${inviteRequestId}?token=${randomToken}`,
	})
}

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await authenticator.isAuthenticated(request)

	const teamId = new URL(request.url).searchParams.get('team_id')

	if (!user) {
		const session = await getSession(request.headers.get('Cookie'))

		session.set('inviteRequestTeamId', teamId) // Should I clean up this session property somewhere?

		return redirect('/signup', {
			headers: {
				'Set-Cookie': await commitSession(session),
			},
		})
	}

	const db = getDb()
	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.id, Number(teamId)),
		with: {
			teamsUsers: {
				with: {
					user: true,
				},
			},
		},
	})

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	const [teamUser] = team.teamsUsers

	invariant(teamUser, 'No team user for team')

	const randomToken = randomBytes(16).toString('hex')

	const [{ inviteRequestId }] = await db
		.insert(userInviteRequests)
		.values({
			userId: user.id,
			teamId: team.id,
			token: randomToken,
			createdAt: formatISO(new Date()),
		})
		.returning({ inviteRequestId: userInviteRequests.id })

	sendInviteRequestEmail({
		teamId: team.id,
		requesterName: user.name,
		email: teamUser.user.email,
		inviteRequestId,
		randomToken,
	})

	return json({ teamName: team.name })
}

export default function RequestInvite() {
	const { teamName } = useLoaderData<typeof loader>()
	return (
		<>
			<Nav title="Invite request" />
			<p>Your request to join {teamName} has been sent to the team admin.</p>
			<p>You'll get an email when it's been approved.</p>
		</>
	)
}
