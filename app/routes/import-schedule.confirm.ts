import { ActionFunction, json } from '@remix-run/node'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { Game, games } from '~/schema'

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

	const teamId = formData.get('team_id')

	const [userHasAccessToTeam] = await Promise.all([
		hasAccessToTeam(user, Number(teamId)),
	])

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	const gamesToAdd = JSON.parse(formData.get('games') as string)

	const db = getDb()

	await db
		.insert(games)
		.values(
			gamesToAdd.map((game: Omit<Game, 'teamId'>) => ({ teamId, ...game }))
		)

	return json({ success: true })
}
