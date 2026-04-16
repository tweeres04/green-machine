import { formatISO } from 'date-fns'
import type { getDb } from '~/lib/getDb'

/**
 * Resolves the selected season from URL search params.
 * - "all" → null (show all seasons)
 * - numeric ID → that specific season
 * - no param → auto-detect current season (or null if none active)
 */
export async function resolveSeason(
	db: ReturnType<typeof getDb>,
	teamId: number,
	seasonId: string | null
) {
	if (seasonId === 'all') return null

	if (seasonId) {
		return (
			(await db.query.seasons.findFirst({
				where: (seasons, { and, eq }) =>
					and(
						eq(seasons.teamId, teamId),
						eq(seasons.id, parseInt(seasonId))
					),
			})) ?? null
		)
	}

	// Auto-detect current season
	return (
		(await db.query.seasons.findFirst({
			where: (seasons, { and, eq, gte, lte }) =>
				and(
					eq(seasons.teamId, teamId),
					lte(seasons.startDate, formatISO(new Date())),
					gte(seasons.endDate, formatISO(new Date()))
				),
		})) ?? null
	)
}
