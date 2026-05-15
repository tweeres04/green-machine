import { ActionFunction, json } from '@remix-run/node'
import { createInsertSchema } from 'drizzle-zod'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { games } from '~/schema'

const GamesSchema = createInsertSchema(games).omit({ teamId: true }).array()

export const action: ActionFunction = async ({ request }) => {
	const [user, formData] = await Promise.all([
		authenticator.isAuthenticated(request).then((user) => {
			if (!user) {
				throw new Response(null, { status: 401 })
			}
			return user
		}),
		request.formData(),
	])

	const teamId = Number(formData.get('team_id'))

	const userHasAccessToTeam = await hasAccessToTeam(user, teamId)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	const parseResult = GamesSchema.safeParse(
		JSON.parse(formData.get('games') as string)
	)
	if (!parseResult.success) {
		return new Response(null, { status: 400 })
	}

	const db = getDb()

	await db
		.insert(games)
		.values(parseResult.data.map((game) => ({ ...game, teamId })))

	return json({ success: true })
}
