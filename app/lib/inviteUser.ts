import invariant from 'tiny-invariant'
import { getDb } from './getDb'
import Mailgun from 'mailgun.js'
import { randomBytes } from 'node:crypto'
import { userInvites } from '~/schema'

async function sendInviteEmail({
	teamId,
	inviterName,
	email,
	inviteId,
	randomToken,
}: {
	teamId: number
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
		from: 'TeamStats Invite <invites@teamstats.tweeres.com>',
		to: email,
		subject: `${inviterName} invited you to join ${teamName} on TeamStats`,
		text: `Accept your invite here: ${process.env.BASE_URL}/invites/${inviteId}?token=${randomToken}`,
	})
}

export async function inviteUser({
	email,
	playerId,
	userId,
	inviterName,
	teamId,
}: {
	email: string
	playerId: number
	userId: number
	teamId: number
	inviterName: string
}) {
	const randomToken = randomBytes(16).toString('hex')

	const db = getDb()

	const insertedInvites = await db
		.insert(userInvites)
		.values({
			email,
			playerId: playerId,
			createdAt: new Date().toISOString(),
			token: randomToken,
			inviterId: userId,
		})
		.returning({ inviteId: userInvites.id })

	const { inviteId } = insertedInvites[0]

	sendInviteEmail({
		teamId,
		inviteId,
		inviterName,
		email,
		randomToken,
	})
}
