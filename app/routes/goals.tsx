import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { goldenBootEntries, players } from '../schema'
import { eq } from 'drizzle-orm'

import { getDb } from '~/lib/getDb'

export const meta: MetaFunction = () => {
	return [
		{ title: 'Bears goals' },
		{ name: 'description', content: 'Bears goals' },
		{ name: 'robots', context: 'noindex' },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const db = getDb()

	const goals = await db
		.select({
			id: goldenBootEntries.id,
			player: players.name,
			timestamp: goldenBootEntries.timestamp,
			goals: goldenBootEntries.goals,
		})
		.from(goldenBootEntries)
		.leftJoin(players, eq(players.id, goldenBootEntries.playerId))

	return goals
}

export default function Index() {
	const goals = useLoaderData<typeof loader>()

	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<h1 className="text-3xl">The Bears</h1>
			<div className="golden-boot">
				<h2 className="text-2xl mb-3">Goals</h2>
				<table className="w-full">
					<thead>
						<tr>
							<th>Date</th>
							<th>Player</th>
							<th className="text-right">Goals</th>
						</tr>
					</thead>
					<tbody>
						{goals.map((g) => (
							<tr key={g.id}>
								<td>{g.timestamp}</td>
								<td>{g.player}</td>
								<td className="text-right">{g.goals}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
