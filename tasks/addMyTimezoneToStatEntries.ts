import { formatISO } from 'date-fns'
import { getDb } from '~/lib/getDb'
import { tz } from '@date-fns/tz'
import { statEntries as statEntriesTable } from '~/schema'
import { eq } from 'drizzle-orm'

const db = getDb()

const statEntries = await db.query.statEntries.findMany()

const newStatEntries = statEntries.map((statEntry) => {
	const originalDate = statEntry.timestamp
	const adjustedDate = formatISO(statEntry.timestamp, {
		in: tz('America/Vancouver'),
	})

	return {
		...statEntry,
		timestamp: adjustedDate,
		originalDate,
	}
})

const result = await db.transaction(async (tx) => {
	await Promise.all(
		newStatEntries.map((se) =>
			tx
				.update(statEntriesTable)
				.set({ timestamp: se.timestamp })
				.where(eq(statEntriesTable.id, se.id))
		)
	)
})

console.log('Done', result)

// console.table(newStatEntries)
