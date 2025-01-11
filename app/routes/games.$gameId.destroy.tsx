import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { getDb } from '~/lib/getDb'
import { games } from '~/schema'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import invariant from 'tiny-invariant'

export async function action({ request, params }: ActionFunctionArgs) {
	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const game = await db.query.games.findFirst({
		columns: {
			teamId: true,
		},
		where: (games, { eq }) => eq(games.id, Number(params.gameId)),
	})

	invariant(game, 'Game not found')

	const teamId = game.teamId

	const userHasAccessToTeam = await hasAccessToTeam(user, Number(teamId))

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	return db.delete(games).where(eq(games.id, Number(params.gameId)))
}
