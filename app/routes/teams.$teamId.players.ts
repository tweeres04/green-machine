import { ActionFunctionArgs } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { players, userInvites } from '~/schema'
import { randomBytes } from 'node:crypto'

import Mailgun from 'mailgun.js'

async function sendInviteEmail({
	teamId,
	inviterName,
	email,
	inviteId,
	randomToken,
}: {
	teamId: string
	inviterName: string
	email: string
	inviteId: number
	randomToken: string
}) {
	invariant(process.env.MAILGUN_API_KEY, 'No MAILGUN_API_KEY')
	invariant(process.env.MAILGUN_DOMAIN, 'No MAILGUN_DOMAIN')
	invariant(process.env.BASE_URL, 'No BASE_URL')

	const db = getDb()

	const teamRecord = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.id, Number(teamId)),
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
		from: 'TeamStats Invite <invites@teamstats.tweeres.com>',
		to: email,
		subject: `${inviterName} invited you to join ${teamName} on TeamStats`,
		text: `Accept your invite here: ${process.env.BASE_URL}/invites/${inviteId}?token=${randomToken}`,
	})
}

export async function action({
	request,
	params: { teamId },
}: ActionFunctionArgs) {
	invariant(teamId, 'Missing teamId parameter')

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const userHasAccessToTeam = await hasAccessToTeam(user, Number(teamId))

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	const formData = await request.formData()
	const name = formData.get('name')
	const email = formData.get('email')

	if (typeof name !== 'string') {
		throw new Response('Name is required', { status: 400 })
	}

	const randomToken = randomBytes(16).toString('hex')

	return db.transaction(async (tx) => {
		const newPlayers = await tx
			.insert(players)
			.values({ name, teamId: Number(teamId) })
			.returning()
		const newPlayer = newPlayers[0]

		if (email && typeof email === 'string') {
			const insertedInvites = await tx
				.insert(userInvites)
				.values({
					email,
					playerId: newPlayer.id,
					createdAt: new Date().toISOString(),
					token: randomToken,
					inviterId: user.id,
				})
				.returning({ inviteId: userInvites.id })

			const { inviteId } = insertedInvites[0]

			sendInviteEmail({
				teamId,
				inviteId,
				inviterName: user.name,
				email,
				randomToken,
			})
		}

		return null
	})
}
