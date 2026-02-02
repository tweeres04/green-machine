import { countDistinct, isNotNull, eq, and } from 'drizzle-orm'
import { getDb } from './getDb'
import { statEntries, players } from '~/schema'

/**
 * Count distinct games that have at least one stat entry for a team.
 * Returns the number of games with stats for the given team.
 */
export async function getGamesWithStatsCount(teamId: number): Promise<number> {
	const db = getDb()

	const result = await db
		.select({
			count: countDistinct(statEntries.gameId),
		})
		.from(statEntries)
		.innerJoin(players, eq(statEntries.playerId, players.id))
		.where(and(isNotNull(statEntries.gameId), eq(players.teamId, teamId)))

	return result[0]?.count ?? 0
}
