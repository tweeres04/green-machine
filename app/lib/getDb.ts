import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from '../schema'

const client = createClient({
	url: 'file:./database.db',
})

export function getDb() {
	return drizzle(client, { schema, logger: true })
}
