import { relations } from 'drizzle-orm'
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

type Stat = 'goal' | 'assist'

export const statEntries = sqliteTable('stat_entries', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	playerId: integer('player_id').notNull(),
	timestamp: text('timestamp').notNull(),
	type: text('type').$type<Stat>().notNull(),
})

export const statEntriesRelations = relations(statEntries, ({ one }) => ({
	player: one(players, {
		fields: [statEntries.playerId],
		references: [players.id],
	}),
}))

export type StatEntry = typeof statEntries.$inferSelect

export const players = sqliteTable('players', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
})

export const playersRelations = relations(players, ({ many }) => ({
	statEntries: many(statEntries),
}))

export type Player = typeof players.$inferSelect

export const games = sqliteTable('games', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	datetime: text('datetime').notNull(),
	field: text('field'),
	opponent: text('opponent'),
})

export type Game = typeof games.$inferSelect
