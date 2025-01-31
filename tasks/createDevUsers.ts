import { getDb } from '~/lib/getDb'
import { players, teams, userInvites, users } from '~/schema'
import argon2 from 'argon2'
import { formatISO } from 'date-fns'

const db = getDb()

async function main() {
	const user = await db.transaction(async (tx) => {
		// Create a new user
		const [user] = await tx
			.insert(users)
			.values({
				name: 'Dev Player',
				email: 'devplayer@example.com',
				password: await argon2.hash('asdfasdf'),
			})
			.returning()

		// Get all teams
		const allTeams = await tx.select().from(teams)

		// Assign the user as a player on every team
		await Promise.all(
			allTeams.map(async (t) => {
				const [player] = await tx
					.insert(players)
					.values({
						name: user.name,
						teamId: t.id,
					})
					.returning()
				return tx.insert(userInvites).values({
					userId: user.id,
					email: user.email,
					playerId: player.id,
					createdAt: formatISO(new Date()),
					acceptedAt: formatISO(new Date()),
					token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
					inviterId: 1,
				})
			})
		)

		return user
	})

	console.log(`${user.name} has been added as a player to all teams.`)
}

// TODO disallow this running on production
main().catch((e) => {
	console.error(e)
	process.exit(1)
})
