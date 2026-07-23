import type { LoaderFunctionArgs } from '@remix-run/node'
import { format, formatISO } from 'date-fns'
import invariant from 'tiny-invariant'
import colors from 'tailwindcss/colors'

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

	const nextGame = await db.query.games.findFirst({
		where: (games, { and, eq, gt }) =>
			and(eq(games.teamId, team.id), gt(games.timestamp, formatISO(new Date()))),
		orderBy: (games, { asc }) => [asc(games.timestamp)],
	})

	const palette = teamPalette(team)

	return renderTeamOgImage({
		team,
		season,
		children: nextGame ? (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					flexGrow: 1,
					justifyContent: 'center',
				}}
			>
				<div
					style={{
						fontSize: 28,
						fontWeight: 700,
						color: palette[700],
						textTransform: 'uppercase',
						letterSpacing: 2,
					}}
				>
					Next game
				</div>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 24,
						marginTop: 12,
					}}
				>
					<div style={{ fontSize: 64, fontWeight: 800 }}>
						{`vs ${nextGame.opponent}`}
					</div>
					{nextGame.cancelledAt ? (
						<div
							style={{ fontSize: 36, fontWeight: 700, color: colors.red[600] }}
						>
							Cancelled
						</div>
					) : null}
				</div>
				<div style={{ fontSize: 44, marginTop: 12 }}>
					{format(nextGame.timestamp as string, "E MMM d 'at' h:mma")}
				</div>
				{nextGame.location ? (
					<div style={{ fontSize: 44, color: palette[700], marginTop: 8 }}>
						{nextGame.location}
					</div>
				) : null}
			</div>
		) : (
			<div
				style={{
					display: 'flex',
					flexGrow: 1,
					alignItems: 'center',
					fontSize: 40,
					color: palette[700],
				}}
			>
				No upcoming games scheduled
			</div>
		),
	})
}
