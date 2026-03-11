import type { ActionFunctionArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import {
	statEntries,
	players,
	statEntrySchema,
	teams,
	teamsUsers,
	games,
} from '../schema'
import { eq, inArray, and, isNotNull } from 'drizzle-orm'

import { getDb } from '~/lib/getDb'
import { authenticator } from '~/lib/auth.server'
import { z, ZodError } from 'zod'
import { canAddStatsToGame } from '~/lib/teamHasActiveSubscription'
import { getGamesWithStatsCount } from '~/lib/getGamesWithStatsCount'

export const meta: MetaFunction = () => {
	return [
		{ title: 'Green Machine stats' },
		{ name: 'description', content: 'Green Machine stats' },
		{ name: 'robots', content: 'noindex' },
	]
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method.toLowerCase() !== 'post') {
		throw new Response(null, { status: 404 })
	}

	const [user, data] = await Promise.all([
		authenticator.isAuthenticated(request),
		request.json(),
	])

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	let newEntries: z.infer<typeof statEntrySchema>[]
	try {
		newEntries = data.map((d: unknown) => statEntrySchema.parse(d))
	} catch (err) {
		if (err instanceof ZodError) {
			throw new Response(err.message, {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			})
		}
		throw err
	}

	const db = getDb()
	const newPlayerIds = newEntries.map((e) => e.playerId)
	const accessiblePlayerTeamIds = (
		await db
			.selectDistinct({ playerId: players.id, teamId: players.teamId })
			.from(players)
			.innerJoin(teams, eq(teams.id, players.teamId))
			.innerJoin(teamsUsers, eq(teams.id, teamsUsers.teamId))
			.where(
				and(eq(teamsUsers.userId, user.id), inArray(players.id, newPlayerIds))
			)
	).map(({ playerId, teamId }) => ({ playerId, teamId }))

	const userHasAccessToPlayers = newPlayerIds.every((id) =>
		accessiblePlayerTeamIds.map(({ playerId }) => playerId).includes(id)
	)

	if (!userHasAccessToPlayers) {
		throw new Response(null, { status: 403 })
	}

	// Check if user can add stats based on subscription and free trial
	const teamIds = accessiblePlayerTeamIds.map(({ teamId }) => teamId)
	
	// For simplicity, we'll check the first team (multi-team stat entries are rare)
	const teamId = teamIds[0]
	
	// Get team subscription
	const teamSubscription = await db.query.teamSubscriptions.findFirst({
		where: (ts, { eq }) => eq(ts.teamId, teamId),
	})
	
	// Get the gameId we're adding stats to
	const targetGameId = newEntries[0]?.gameId ?? null
	
	// Check if this game already has stats
	let gameAlreadyHasStats = false
	if (targetGameId) {
		const existingStats = await db
			.select({ id: statEntries.id })
			.from(statEntries)
			.where(and(eq(statEntries.gameId, targetGameId), isNotNull(statEntries.gameId)))
			.limit(1)
		gameAlreadyHasStats = existingStats.length > 0
	}
	
	// Count games with stats for this team
	const gamesWithStatsCount = await getGamesWithStatsCount(teamId)
	
	// Check if team can add stats
	if (!canAddStatsToGame(teamSubscription, gamesWithStatsCount, gameAlreadyHasStats)) {
		return json(
			{
				error: "You've tracked stats for 3 games, the max for free teams. Subscribe to track unlimited games.",
			},
			{
				status: 402,
			}
		)
	}

	return db.transaction(async (tx) => {
		let newGameId = null
		if (newEntries.some((e) => !e.gameId)) {
			const timestamp = newEntries[0].timestamp
			const teamId = accessiblePlayerTeamIds[0].teamId
			const [game] = await tx
				.insert(games)
				.values({ teamId, timestamp })
				.returning({ id: games.id })
			newEntries.forEach((entry) => {
				entry.gameId = game.id
			})
			newGameId = game.id
		}
		await tx.insert(statEntries).values(newEntries)
		return newGameId
	})
}

export async function loader() {
	const db = getDb()

	const stats = await db
		.select({
			id: statEntries.id,
			player: players.name,
			timestamp: statEntries.timestamp,
			type: statEntries.type,
		})
		.from(statEntries)
		.leftJoin(players, eq(players.id, statEntries.playerId))

	return stats
}

export default function Index() {
	const statEntries = useLoaderData<typeof loader>()

	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<h1 className="text-3xl">Green Machine</h1>
			<div className="golden-boot">
				<h2 className="text-2xl mb-3">Stats</h2>
				<table className="w-full">
					<thead>
						<tr>
							<th>Date</th>
							<th>Player</th>
							<th>Type</th>
						</tr>
					</thead>
					<tbody>
						{statEntries.map((se) => (
							<tr key={se.id}>
								<td>{se.timestamp}</td>
								<td>{se.player}</td>
								<td>{se.type}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
