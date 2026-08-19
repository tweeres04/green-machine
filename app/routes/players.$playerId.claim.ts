import { ActionFunctionArgs } from '@remix-run/node'
import { randomBytes } from 'node:crypto'
import { formatISO } from 'date-fns'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { userInvites } from '~/schema'
import { mixpanelServer } from '~/lib/mixpanel.server'

// Lets an admin link themselves to a player without the email invite dance
export async function action({ params, request }: ActionFunctionArgs) {
	const playerId = params.playerId

	invariant(playerId, 'Missing playerId parameter')

	const db = getDb()

	const [user, player] = await Promise.all([
		authenticator.isAuthenticated(request),
		db.query.players.findFirst({
			where: (players, { eq }) => eq(players.id, Number(playerId)),
			with: {
				userInvites: true,
			},
		}),
	])

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	if (!player) {
		throw new Response(null, { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, player.teamId)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	if (player.userInvites.some((ui) => ui.acceptedAt)) {
		throw new Response('Player is already linked to a user', { status: 409 })
	}

	// A pending invite gets claimed rather than duplicated, which also covers
	// admins who emailed themselves an invite and never clicked it
	const pendingInvite = player.userInvites[0]

	if (pendingInvite) {
		await db
			.update(userInvites)
			.set({ userId: user.id, acceptedAt: formatISO(new Date()) })
			.where(eq(userInvites.id, pendingInvite.id))
	} else {
		await db.insert(userInvites).values({
			userId: user.id,
			email: user.email,
			playerId: player.id,
			createdAt: formatISO(new Date()),
			acceptedAt: formatISO(new Date()),
			token: randomBytes(16).toString('hex'),
			inviterId: user.id,
		})
	}

	mixpanelServer.track('claim player', {
		distinct_id: user.id,
		'team id': player.teamId,
		'player id': player.id,
	})

	return null
}
