import { ActionFunctionArgs } from '@remix-run/node'
import { eq, desc, and } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { statEntries } from '~/schema'

// todo merge w goals.destroy_latest
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

	const latestEntry = await db
		.select()
		.from(statEntries)
		.where(
			and(
				eq(statEntries.playerId, Number(params.playerId)),
				eq(statEntries.type, 'assist')
			)
		)
		.orderBy(desc(statEntries.id))
		.limit(1)

	if (latestEntry.length > 0) {
		return db
			.delete(statEntries)
			.where(and(eq(statEntries.id, latestEntry[0].id)))
	}

	return null
}
