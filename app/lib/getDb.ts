import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../schema'

export function getDb() {
	const sqlite = new Database('./database.db')
	return drizzle(sqlite, { schema, logger: true })
}
