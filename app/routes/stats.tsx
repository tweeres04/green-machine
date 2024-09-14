import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { statEntries, players } from '../schema'
import { eq } from 'drizzle-orm'

import { getDb } from '~/lib/getDb'

export const meta: MetaFunction = () => {
	return [
		{ title: 'Bears goals' },
		{ name: 'description', content: 'Bears goals' },
		{ name: 'robots', context: 'noindex' },
	]
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
			<h1 className="text-3xl">The Bears</h1>
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
