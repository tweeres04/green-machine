import type { LoaderFunctionArgs } from '@remix-run/node'
import { endOfDay, format, formatISO, parseISO } from 'date-fns'
import invariant from 'tiny-invariant'

import { getDb } from '~/lib/getDb'
import { renderTeamOgImage, teamPalette } from '~/lib/og-image.server'

export async function loader({ params: { teamSlug } }: LoaderFunctionArgs) {
	invariant(teamSlug, 'Missing teamSlug parameter')

	const db = getDb()

	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
	})

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	const season = await db.query.seasons.findFirst({
		where: (seasons, { and, eq, gte, lte }) =>
			and(
				eq(seasons.teamId, team.id),
				lte(seasons.startDate, formatISO(new Date())),
				gte(seasons.endDate, formatISO(new Date()))
			),
	})

	const players = await db.query.players.findMany({
		where: (players, { eq }) => eq(players.teamId, team.id),
		with: {
			statEntries: season
				? {
						where: (statEntries, { and, gte, lte }) => {
							invariant(season, 'No season inside stats query')

							const endOfSeasonEndDay = formatISO(
								endOfDay(parseISO(season.endDate))
							)

							return and(
								gte(statEntries.timestamp, season.startDate),
								lte(statEntries.timestamp, endOfSeasonEndDay)
							)
						},
				  }
				: true,
		},
	})

	const standings = players
		.map((player) => ({
			name: player.name,
			goals: player.statEntries.filter((se) => se.type === 'goal').length,
			assists: player.statEntries.filter((se) => se.type === 'assist').length,
		}))
		.toSorted(
			(a, b) =>
				b.goals - a.goals ||
				b.assists - a.assists ||
				a.name.localeCompare(b.name)
		)
		.slice(0, 4)

	const nextGame = await db.query.games.findFirst({
		where: (games, { and, eq, gt }) =>
			and(eq(games.teamId, team.id), gt(games.timestamp, formatISO(new Date()))),
		orderBy: (games, { asc }) => [asc(games.timestamp)],
	})

	const palette = teamPalette(team)

	return renderTeamOgImage({
		team,
		season,
		footerLabel: 'Goals and assists leaderboard',
		// satori can't lay out fragments, so pass the rows as an array
		children: [
			...standings.map((player, index) => (
					<div
						key={player.name}
						style={{
							display: 'flex',
							alignItems: 'center',
							fontSize: 36,
							padding: '10px 0',
						}}
					>
						<div style={{ width: 56, color: palette[700], fontWeight: 700 }}>
							{`${index + 1}`}
						</div>
						<div style={{ flexGrow: 1, fontWeight: 700 }}>{player.name}</div>
						<div style={{ color: palette[700] }}>
							{`${player.goals}G ${player.assists}A`}
						</div>
					</div>
			)),
			nextGame ? (
				<div
					key="next-game"
					style={{
						display: 'flex',
						marginTop: 'auto',
						marginBottom: 16,
						fontSize: 30,
						gap: 12,
					}}
				>
					<div style={{ fontWeight: 700 }}>Next game</div>
					<div style={{ color: palette[700] }}>
						{`vs ${nextGame.opponent} on ${format(
							nextGame.timestamp as string,
							"E MMM d 'at' h:mma"
						)}`}
					</div>
				</div>
			) : null,
		],
	})
}
