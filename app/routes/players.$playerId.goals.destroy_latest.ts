import { ActionFunctionArgs, redirect } from '@remix-run/node'
import { eq, desc, and } from 'drizzle-orm'
import { getDb } from '~/lib/getDb'
import { goldenBootEntries, players } from '~/schema'

export async function action({ params }: ActionFunctionArgs) {
	const db = getDb()

	const latestEntry = await db
		.select()
		.from(goldenBootEntries)
		.where(eq(goldenBootEntries.playerId, Number(params.playerId)))
		.orderBy(desc(goldenBootEntries.id))
		.limit(1)

	if (latestEntry.length > 0) {
		await db
			.delete(goldenBootEntries)
			.where(
				and(
					eq(goldenBootEntries.playerId, Number(params.playerId)),
					eq(goldenBootEntries.id, latestEntry[0].id)
				)
			)
	}

	return redirect('/')
}
