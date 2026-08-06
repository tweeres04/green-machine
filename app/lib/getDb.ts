import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from '../schema'

const url = process.env.DATABASE_URL || 'file:./database/database.db'

const client = createClient({ url })

// WAL so reads don't block behind writes; busy_timeout so concurrent writes
// queue (up to 5s) instead of failing instantly with SQLITE_BUSY. WAL
// persists in the db file; busy_timeout is per-connection so it must be set
// on every startup. Local files only — a remote (libsql://) database manages
// its own write queuing and rejects pragmas.
if (url.startsWith('file:')) {
	// busy_timeout first so the WAL pragma itself waits for the lock instead
	// of failing when another process has the db open
	client.executeMultiple(
		'PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;'
	)
}

export function getDb() {
	return drizzle(client, { schema, logger: true })
}
