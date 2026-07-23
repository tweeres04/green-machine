import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

import type { LoaderFunctionArgs } from '@remix-run/node'
import { endOfDay, formatISO, parseISO } from 'date-fns'
import satori from 'satori'
import sharp from 'sharp'
import { Resvg } from '@resvg/resvg-js'
import invariant from 'tiny-invariant'
import colors from 'tailwindcss/colors'

import { getDb } from '~/lib/getDb'

const require = createRequire(import.meta.url)

function fontData(weight: number) {
	return readFileSync(
		require.resolve(
			`@fontsource/nunito-sans/files/nunito-sans-latin-${weight}-normal.woff`
		)
	)
}

const fonts = [
	{ name: 'Nunito Sans', weight: 400 as const, data: fontData(400) },
	{ name: 'Nunito Sans', weight: 700 as const, data: fontData(700) },
	{ name: 'Nunito Sans', weight: 800 as const, data: fontData(800) },
]

async function fetchLogoDataUri(teamId: number) {
	const response = await fetch(
		`https://files.tweeres.com/teamstats/teams/${teamId}/logo`
	)

	if (!response.ok) {
		return null
	}

	const buffer = Buffer.from(await response.arrayBuffer())
	// Normalize to a small png: logos are uploaded in whatever format the user
	// picked (webp, progressive jpeg, 2048px pngs), and resvg can't draw webp
	const png = await sharp(buffer)
		.resize(160, 160, { fit: 'cover' })
		.png()
		.toBuffer()

	return `data:image/png;base64,${png.toString('base64')}`
}

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
		.slice(0, 5)

	const palette = colors[team.color as keyof typeof colors] as Record<
		string,
		string
	>
	const logoDataUri = await fetchLogoDataUri(team.id)

	const svg = await satori(
		<div
			style={{
				width: 1200,
				height: 630,
				display: 'flex',
				flexDirection: 'column',
				backgroundColor: palette[50],
				color: palette[900],
				fontFamily: 'Nunito Sans',
				padding: '48px 64px',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
				{logoDataUri ? (
					<img
						alt=""
						src={logoDataUri}
						width={80}
						height={80}
						style={{ borderRadius: 40, objectFit: 'cover' }}
					/>
				) : (
					<div
						style={{
							width: 80,
							height: 80,
							borderRadius: 40,
							backgroundColor: palette[200],
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: 40,
							fontWeight: 700,
						}}
					>
						{team.name[0]}
					</div>
				)}
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<div style={{ fontSize: 56, fontWeight: 800 }}>{team.name}</div>
					{season ? (
						<div style={{ fontSize: 28, color: palette[700] }}>
							{season.name}
						</div>
					) : null}
				</div>
			</div>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					marginTop: 40,
					flexGrow: 1,
				}}
			>
				{standings.map((player, index) => (
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
				))}
			</div>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					fontSize: 26,
					color: palette[700],
				}}
			>
				<div>Goals and assists leaderboard</div>
				<div>teamstats.tweeres.com</div>
			</div>
		</div>,
		{ width: 1200, height: 630, fonts }
	)

	const png = new Resvg(svg).render().asPng()

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=3600',
		},
	})
}
