import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'

import satori from 'satori'
import sharp from 'sharp'
import { Resvg } from '@resvg/resvg-js'
import colors from 'tailwindcss/colors'

import { Season, Team } from '~/schema'

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

export function teamPalette(team: Team) {
	return colors[team.color as keyof typeof colors] as Record<string, string>
}

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

// Renders the shared 1200x630 frame (team header, footer) around the given
// content and returns it as a png Response
export async function renderTeamOgImage({
	team,
	season,
	footerLabel,
	children,
}: {
	team: Team
	season: Season | undefined
	footerLabel?: string
	children: ReactNode
}) {
	const palette = teamPalette(team)
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
				{children}
			</div>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					fontSize: 26,
					color: palette[700],
				}}
			>
				<div>{footerLabel ?? ''}</div>
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
