import { ActionFunctionArgs } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { statEntries } from '~/schema'

export async function action({ params, request }: ActionFunctionArgs) {
	invariant(params.playerId, 'No player ID')

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const player = await db.query.players.findFirst({
		where: (players, { eq }) => eq(players.id, Number(params.playerId)),
	})

	invariant(player, 'Player not found')

	const userHasAccessToTeam = await hasAccessToTeam(user, player.teamId)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	return db.insert(statEntries).values({
		timestamp: new Date().toISOString(),
		playerId: Number(params.playerId),
		type: 'goal',
	})
}
