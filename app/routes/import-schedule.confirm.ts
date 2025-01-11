import { ActionFunction, json } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { Game, games } from '~/schema'

export const action: ActionFunction = async ({ request }) => {
	const formData = await request.formData()
	const teamId = formData.get('team_id')
	const gamesToAdd = JSON.parse(formData.get('games') as string)

	const db = getDb()

	await db
		.insert(games)
		.values(
			gamesToAdd.map((game: Omit<Game, 'teamId'>) => ({ teamId, ...game }))
		)

	return json({ success: true })
}
