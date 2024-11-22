import type { ActionFunctionArgs, MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import {
	statEntries,
	players,
	statEntrySchema,
	teams,
	teamsUsers,
} from '../schema'
import { eq, inArray, and } from 'drizzle-orm'

import { getDb } from '~/lib/getDb'
import { authenticator } from '~/lib/auth.server'
import { z, ZodError } from 'zod'
import { activeSubscription } from '~/lib/teamHasActiveSubscription'

export const meta: MetaFunction = () => {
	return [
		{ title: 'Green Machine stats' },
		{ name: 'description', content: 'Green Machine stats' },
		{ name: 'robots', context: 'noindex' },
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

	const teamIds = accessiblePlayerTeamIds.map(({ teamId }) => teamId)
	const teamsWithActiveSubscription = await db.query.teamSubscriptions.findMany(
		{
			where: (teamSubscription, { inArray }) =>
				inArray(teamSubscription.teamId, teamIds),
		}
	)

	if (!teamsWithActiveSubscription.every(activeSubscription)) {
		throw new Response(null, {
			status: 402,
		})
	}

	return db.insert(statEntries).values(newEntries)
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
