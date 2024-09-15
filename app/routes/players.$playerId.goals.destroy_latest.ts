import { ActionFunctionArgs } from '@remix-run/node'
import { eq, desc, and } from 'drizzle-orm'
import { getDb } from '~/lib/getDb'
import { statEntries } from '~/schema'

export async function action({ params }: ActionFunctionArgs) {
	const db = getDb()

	const latestEntry = await db
		.select()
		.from(statEntries)
		.where(
			and(
				eq(statEntries.playerId, Number(params.playerId)),
				eq(statEntries.type, 'goal')
			)
		)
		.orderBy(desc(statEntries.id))
		.limit(1)

	if (latestEntry.length > 0) {
		return db
			.delete(statEntries)
			.where(and(eq(statEntries.id, latestEntry[0].id)))
	}

	return null
}
