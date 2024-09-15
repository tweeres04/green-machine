import { ActionFunctionArgs } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { statEntries } from '~/schema'

export async function action({ params }: ActionFunctionArgs) {
	const db = getDb()

	return db.insert(statEntries).values({
		timestamp: new Date().toISOString(),
		playerId: Number(params.playerId),
		type: 'goal',
	})
}
