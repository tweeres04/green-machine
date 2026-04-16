import type {
	LoaderFunctionArgs,
	MetaArgs,
	MetaFunction,
} from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { format, parseISO, endOfDay, formatISO } from 'date-fns'
import Nav from '~/components/ui/nav'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '~/components/ui/breadcrumb'
import { SeasonDropdown } from '~/components/ui/season-dropdown'
import { StatsDialog } from '~/components/ui/stats-dialog'
import { cn } from '~/lib/utils'
import { getDb } from '~/lib/getDb'
import { resolveSeason } from '~/lib/resolveSeason'
import type { Team } from '~/schema'

export const meta: MetaFunction = ({ data }: MetaArgs) => {
	if (!data) return [{ title: 'Player not found' }]
	const { team, player } = data as {
		team: Team
		player: { name: string }
	}
	const title = `${player.name} - ${team.name} - TeamStats`
	return [
		{ title },
		{ name: 'robots', content: 'noindex' },
	]
}

export async function loader({
	params: { teamSlug, playerId },
	request,
}: LoaderFunctionArgs) {
	invariant(teamSlug, 'Missing teamSlug')
	invariant(playerId, 'Missing playerId')

	const db = getDb()
	const searchParams = new URL(request.url).searchParams
	const seasonParam = searchParams.get('season')

	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
		with: {
			seasons: {
				orderBy: (seasons, { desc }) => [desc(seasons.startDate)],
			},
		},
	})
	if (!team) throw new Response('Team not found', { status: 404 })

	const playerIdNum = parseInt(playerId)
	const nowIso = formatISO(new Date())

	const playerPromise = db.query.players.findFirst({
		where: (players, { and, eq }) =>
			and(eq(players.id, playerIdNum), eq(players.teamId, team.id)),
	})

	const teamGamesPromise = resolveSeason(db, team.id, seasonParam).then(
		async (season) => {
			const seasonDateFilter = season
				? {
						start: season.startDate,
						end: formatISO(endOfDay(parseISO(season.endDate))),
					}
				: null

			const games = await db.query.games.findMany({
				where: (games, { and, eq, gte, lte, isNull }) => {
					const conditions = [
						eq(games.teamId, team.id),
						isNull(games.cancelledAt),
						lte(games.timestamp, nowIso),
					]
					if (seasonDateFilter) {
						conditions.push(gte(games.timestamp, seasonDateFilter.start))
						conditions.push(lte(games.timestamp, seasonDateFilter.end))
					}
					return and(...conditions)
				},
				orderBy: (games, { desc }) => [desc(games.timestamp)],
				with: {
					statEntries: {
						with: { player: { columns: { id: true, name: true } } },
					},
					rsvps: {
						where: (rsvps, { eq }) => eq(rsvps.playerId, playerIdNum),
					},
				},
			})

			return { season, games }
		}
	)

	const [player, { season, games: teamGames }] = await Promise.all([
		playerPromise,
		teamGamesPromise,
	])
	if (!player) throw new Response('Player not found', { status: 404 })

	const playerStats = (g: (typeof teamGames)[number]) =>
		g.statEntries.filter((s) => s.playerId === playerIdNum)

	// Attended: games where RSVP is null or 'yes' (exclude explicit 'no')
	const didAttend = (g: (typeof teamGames)[number]) =>
		!g.rsvps.some((r) => r.rsvp === 'no')

	const attendedGames = teamGames.filter(didAttend)

	const totalGoals = attendedGames.reduce(
		(acc, g) => acc + playerStats(g).filter((s) => s.type === 'goal').length,
		0
	)
	const totalAssists = attendedGames.reduce(
		(acc, g) => acc + playerStats(g).filter((s) => s.type === 'assist').length,
		0
	)

	const gamesPlayedCount = attendedGames.length
	const goalsPerGame =
		gamesPlayedCount > 0
			? Math.round((totalGoals / gamesPlayedCount) * 100) / 100
			: 0
	const assistsPerGame =
		gamesPlayedCount > 0
			? Math.round((totalAssists / gamesPlayedCount) * 100) / 100
			: 0

	// Streaks: attendedGames is already past-only and sorted desc
	function computeStreaks(type: 'goal' | 'assist') {
		let current = 0
		for (const game of attendedGames) {
			if (playerStats(game).some((s) => s.type === type)) current++
			else break
		}

		let longest = 0
		let run = 0
		for (const game of attendedGames) {
			if (playerStats(game).some((s) => s.type === type)) {
				run++
				if (run > longest) longest = run
			} else {
				run = 0
			}
		}
		return { current, longest }
	}

	const goalStreak = computeStreaks('goal')
	const assistStreak = computeStreaks('assist')
	const currentStreak = Math.max(goalStreak.current, assistStreak.current)
	const longestStreak = Math.max(goalStreak.longest, assistStreak.longest)

	// Game log: all games (including 'no' RSVPs, marked as not attended)
	const gameLog = teamGames.map((g) => ({
		id: g.id,
		date: g.timestamp,
		opponent: g.opponent,
		goals: playerStats(g).filter((s) => s.type === 'goal').length,
		assists: playerStats(g).filter((s) => s.type === 'assist').length,
		attended: didAttend(g),
		statEntries: g.statEntries,
		rsvps: g.rsvps,
	}))

	return {
		team,
		player,
		seasons: team.seasons,
		season,
		summary: {
			totalGoals,
			totalAssists,
			gamesPlayedCount,
			goalsPerGame,
			assistsPerGame,
			currentStreak,
			longestStreak,
		},
		gameLog,
	}
}

export default function PlayerStatsPage() {
	const { team, player, seasons, season, summary, gameLog } =
		useLoaderData<typeof loader>()

	return (
		<div className={`bg-${team.color}-50 min-h-screen p-2`}>
			<Nav team={team} title={player.name} />

			<div className="max-w-2xl mx-auto mt-6 space-y-8">
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to={`/${team.slug}`}>{team.name}</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{player.name}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<div className="space-y-3">
					<h1 className="text-2xl font-bold">{player.name}</h1>
					{seasons.length > 0 && (
						<SeasonDropdown seasons={seasons} season={season} />
					)}
				</div>

				<div className="grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-4">
					<StatValue label="Goals" value={summary.totalGoals} />
					<StatValue label="Assists" value={summary.totalAssists} />
					<StatValue label="Games" value={summary.gamesPlayedCount} />
					<StatValue label="Goals / game" value={summary.goalsPerGame} />
					<StatValue label="Assists / game" value={summary.assistsPerGame} />
					<StatValue label="Current streak" value={summary.currentStreak} />
					<StatValue label="Longest streak" value={summary.longestStreak} />
				</div>

				{gameLog.length > 0 && (
					<div>
						<h2 className="text-lg font-semibold mb-3">Game log</h2>
						<table className="w-full text-sm">
							<thead>
								<tr className={`border-b border-${team.color}-200 text-left`}>
									<th className="py-2 pr-3 font-medium">Date</th>
									<th className="py-2 px-3 font-medium">Opponent</th>
									<th className="py-2 px-3 font-medium text-center">⚽️</th>
									<th className="py-2 px-3 font-medium text-center">🍎</th>
								</tr>
							</thead>
							<tbody>
								{gameLog.map((game) => (
									<tr
										key={game.id}
										className={cn(
											`border-b border-${team.color}-100`,
											!game.attended && 'text-gray-400'
										)}
									>
										<td className="py-2 pr-3">
											<StatsDialog
												game={{
													id: game.id,
													opponent: game.opponent,
													timestamp: game.date,
												}}
												statEntries={game.statEntries}
												player={{ rsvps: game.rsvps }}
											>
												<button className="cursor-pointer hover:underline">
													{game.date
														? format(parseISO(game.date), 'MMM d')
														: '—'}
												</button>
											</StatsDialog>
										</td>
										<td className="py-2 px-3">
											<StatsDialog
												game={{
													id: game.id,
													opponent: game.opponent,
													timestamp: game.date,
												}}
												statEntries={game.statEntries}
												player={{ rsvps: game.rsvps }}
											>
												<button className="cursor-pointer hover:underline text-left">
													<div>{game.opponent ?? '—'}</div>
													{!game.attended && (
														<div className="text-xs italic">Did not play</div>
													)}
												</button>
											</StatsDialog>
										</td>
										<td className="py-2 px-3 text-center">
											{game.attended ? game.goals || '—' : '—'}
										</td>
										<td className="py-2 px-3 text-center">
											{game.attended ? game.assists || '—' : '—'}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{gameLog.length === 0 && (
					<p className="text-sm text-gray-500">
						No games found{season ? ` for ${season.name}` : ''}.
					</p>
				)}
			</div>
		</div>
	)
}

function StatValue({
	label,
	value,
}: {
	label: string
	value: string | number
}) {
	return (
		<div>
			<div className="text-2xl font-bold">{value}</div>
			<div className="text-sm text-gray-500">{label}</div>
		</div>
	)
}
