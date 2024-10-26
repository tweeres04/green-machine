import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { getDb } from '~/lib/getDb'
import { games } from '~/schema'

export async function action({ params, request }: ActionFunctionArgs) {
	const { gameId } = params

	invariant(gameId, 'No gameId')

	if (request.method.toLowerCase() !== 'put') {
		throw new Response(null, { status: 404 })
	}

	const db = getDb()

	const formData = await request.formData()

	const timestamp = formData.get('timestamp')
	const opponent = formData.get('opponent')
	const location = formData.get('location')

	if (typeof opponent !== 'string') {
		throw new Response('Opponent is required', { status: 400 })
	}

	return db
		.update(games)
		.set({
			timestamp,
			opponent,
			location,
		})
		.where(eq(games.id, Number(gameId)))
}
