import { relations } from 'drizzle-orm'
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'
import { createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'

import Stripe from 'stripe'

export const teams = sqliteTable('teams', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	color: text('color').notNull().default('gray'),
})

export type Team = typeof teams.$inferSelect

export const teamRelations = relations(teams, ({ many, one }) => ({
	players: many(players),
	games: many(games),
	teamsUsers: many(teamsUsers),
	subscription: one(teamSubscriptions),
	seasons: many(seasons),
}))

export const teamSubscriptions = sqliteTable(
	'team_subscriptions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
		subscriptionStatus: text('subscription_status')
			.$type<Stripe.Subscription.Status>()
			.notNull(),
		periodEnd: integer('period_end').notNull(),
		cancelAtPeriodEnd: integer('cancel_at_period_end', {
			mode: 'boolean',
		}).notNull(),
		teamId: integer('team_id').notNull(),
	},
	(table) => ({
		teamIdIdx: index('team_subscriptions_team_id_idx').on(table.teamId),
	})
)

export type TeamSubscription = typeof teamSubscriptions.$inferSelect

export const teamSubscriptionsRelations = relations(
	teamSubscriptions,
	({ one }) => ({
		team: one(teams, {
			fields: [teamSubscriptions.teamId],
			references: [teams.id],
		}),
	})
)

export const players = sqliteTable(
	'players',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		teamId: integer('team_id').notNull(),
		name: text('name').notNull(),
	},
	(table) => ({
		teamIdIdx: index('players_team_id_idx').on(table.teamId),
	})
)

export type Player = typeof players.$inferSelect

export const playersRelations = relations(players, ({ many, one }) => ({
	statEntries: many(statEntries),
	team: one(teams, {
		fields: [players.teamId],
		references: [teams.id],
	}),
	userInvite: one(userInvites, {
		fields: [players.id],
		references: [userInvites.playerId],
	}),
	rsvps: many(rsvps),
}))

export const userInvites = sqliteTable(
	'user_invites',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id'),
		email: text('email').notNull(),
		playerId: integer('player_id').notNull(),
		createdAt: text('created_at').notNull(),
		acceptedAt: text('accepted_at'),
		token: text('token').notNull(),
		inviterId: integer('inviter_id').notNull(),
	},
	(table) => ({
		idIdx: index('user_invites_id_idx').on(table.id),
		userIdIdx: index('user_invites_user_id_idx').on(table.userId),
		playerIdIdx: index('user_invites_player_id_idx').on(table.playerId),
		inviterIdIdx: index('user_invites_inviter_id_idx').on(table.inviterId),
	})
)

export const userInvitesRelations = relations(userInvites, ({ one }) => ({
	player: one(players, {
		fields: [userInvites.playerId],
		references: [players.id],
	}),
	inviter: one(users, {
		fields: [userInvites.inviterId],
		references: [users.id],
		relationName: 'sent_invites',
	}),
	user: one(users, {
		fields: [userInvites.userId],
		references: [users.id],
		relationName: 'received_invites',
	}),
}))

export const games = sqliteTable(
	'games',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		teamId: integer('team_id').notNull(),
		opponent: text('opponent').notNull(),
		timestamp: text('timestamp'),
		location: text('location'),
		cancelledAt: text('cancelled_at'),
	},
	(table) => ({
		teamIdIdx: index('games_team_id_idx').on(table.teamId),
	})
)

export type Game = typeof games.$inferSelect

export const gamesRelations = relations(games, ({ one, many }) => ({
	team: one(teams, {
		fields: [games.teamId],
		references: [teams.id],
	}),
	rsvps: many(rsvps),
	statEntries: many(statEntries), // Add this line
}))

const statSchema = z.enum(['goal', 'assist'])
type Stat = z.infer<typeof statSchema>

export const statEntries = sqliteTable(
	'stat_entries',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		playerId: integer('player_id').notNull(),
		timestamp: text('timestamp').notNull(),
		type: text('type').$type<Stat>().notNull(),
		gameId: integer('game_id'),
	},
	(table) => ({
		playerIdIdx: index('player_id_idx').on(table.playerId),
		gameIdIdx: index('game_id_idx').on(table.gameId),
	})
)

export const statEntriesRelations = relations(statEntries, ({ one }) => ({
	player: one(players, {
		fields: [statEntries.playerId],
		references: [players.id],
	}),
	game: one(games, {
		fields: [statEntries.gameId],
		references: [games.id],
	}),
}))

export type StatEntry = typeof statEntries.$inferSelect
export const statEntrySchema = createInsertSchema(statEntries, {
	timestamp: (schema) =>
		schema.timestamp.datetime({
			offset: true,
		}),
	type: statSchema,
})

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	password: text('password').notNull(),
	name: text('name').notNull(),
	stripeCustomerId: text('stripe_customer_id'),
})

export const userRelations = relations(users, ({ many }) => ({
	teamsUsers: many(teamsUsers),
	sentInvites: many(userInvites, { relationName: 'sent_invites' }),
	receivedInvites: many(userInvites, { relationName: 'received_invites' }),
}))

export type User = Omit<typeof users.$inferSelect, 'password'>

export const teamsUsers = sqliteTable(
	'users_teams',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id').notNull(),
		teamId: integer('team_id').notNull(),
	},
	(table) => ({
		userIdIdx: index('users_teams_user_id_idx').on(table.userId),
		teamIdIdx: index('users_teams_team_id_idx').on(table.teamId),
	})
)

export const usersTeamsRelations = relations(teamsUsers, ({ one }) => ({
	user: one(users, {
		fields: [teamsUsers.userId],
		references: [users.id],
	}),
	team: one(teams, {
		fields: [teamsUsers.teamId],
		references: [teams.id],
	}),
}))

type Rsvp = 'yes' | 'no'

export const rsvps = sqliteTable(
	'rsvps',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		playerId: integer('player_id').notNull(),
		gameId: integer('game_id').notNull(),
		rsvp: text('rsvp').$type<Rsvp>().notNull(),
	},
	(table) => ({
		idIdx: index('rsvps_id_idx').on(table.id),
		playerIdIdx: index('rsvps_player_id_idx').on(table.playerId),
		gameIdIdx: index('rsvps_game_id_idx').on(table.gameId),
	})
)

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
	player: one(players, {
		fields: [rsvps.playerId],
		references: [players.id],
	}),
	game: one(games, {
		fields: [rsvps.gameId],
		references: [games.id],
	}),
}))

export const seasons = sqliteTable('seasons', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	startDate: text('start_date').notNull(),
	endDate: text('end_date').notNull(),
	teamId: integer('team_id').notNull(),
})

export const seasonsRelations = relations(seasons, ({ one }) => ({
	team: one(teams, {
		fields: [seasons.teamId],
		references: [teams.id],
	}),
}))

export type Season = typeof seasons.$inferSelect
