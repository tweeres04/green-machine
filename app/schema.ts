import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

export const goldenBootEntries = sqliteTable('golden_boot_entries', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	playerId: integer('player_id').notNull(),
	date: text('date').notNull(),
	goals: integer('goals').notNull(),
})

export type GoldenBootEntry = typeof goldenBootEntries.$inferSelect

export const players = sqliteTable('players', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
})

export type Player = typeof goldenBootEntries.$inferSelect
