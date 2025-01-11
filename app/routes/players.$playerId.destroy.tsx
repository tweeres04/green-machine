import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { getDb } from '~/lib/getDb'
import { players } from '~/schema'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import invariant from 'tiny-invariant'

// todo: protect this
export async function action({ request, params }: ActionFunctionArgs) {
	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const player = await db.query.players.findFirst({
		columns: {
			teamId: true,
		},
		where: (players, { eq }) => eq(players.id, Number(params.playerId)),
	})

	invariant(player, 'Player not found')

	const teamId = player.teamId

	const userHasAccessToTeam = await hasAccessToTeam(user, Number(teamId))

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	return db.delete(players).where(eq(players.id, Number(params.playerId)))
}
