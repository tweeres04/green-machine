import { relations } from 'drizzle-orm'
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'

export const teams = sqliteTable(
	'teams',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		color: text('color').notNull().default('gray'),
	},
	(table) => ({
		slugIdx: index('slug_idx').on(table.slug),
	})
)

export type Team = typeof teams.$inferSelect

export const teamRelations = relations(teams, ({ many }) => ({
	players: many(players),
}))

export const players = sqliteTable(
	'players',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		teamId: integer('team_id').notNull(),
		name: text('name').notNull(),
	},
	(table) => ({
		teamIdIdx: index('team_id_idx').on(table.teamId),
	})
)

export type Player = typeof players.$inferSelect

export const playersRelations = relations(players, ({ many, one }) => ({
	statEntries: many(statEntries),
	team: one(teams, {
		fields: [players.teamId],
		references: [teams.id],
	}),
}))

type Stat = 'goal' | 'assist'

export const statEntries = sqliteTable(
	'stat_entries',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		playerId: integer('player_id').notNull(),
		timestamp: text('timestamp').notNull(),
		type: text('type').$type<Stat>().notNull(),
	},
	(table) => ({
		playerIdIdx: index('player_id_idx').on(table.playerId),
	})
)

export const statEntriesRelations = relations(statEntries, ({ one }) => ({
	player: one(players, {
		fields: [statEntries.playerId],
		references: [players.id],
	}),
}))

export type StatEntry = typeof statEntries.$inferSelect
