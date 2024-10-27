import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { getDb } from '~/lib/getDb'
import { games } from '~/schema'

async function handlePut(gameId: string, formData: FormData) {
	const db = getDb()

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
async function handlePatch(gameId: string, formData: FormData) {
	const db = getDb()

	const cancelledAt = formData.get('cancelledAt')

	return db
		.update(games)
		.set({
			cancelledAt: cancelledAt === 'null' ? null : cancelledAt,
		})
		.where(eq(games.id, Number(gameId)))
}

export async function action({ params, request }: ActionFunctionArgs) {
	const { gameId } = params

	invariant(gameId, 'No gameId')

	if (request.method.toLowerCase() === 'put') {
		const formData = await request.formData()
		return handlePut(gameId, formData)
	} else if (request.method.toLowerCase() === 'patch') {
		const formData = await request.formData()
		return handlePatch(gameId, formData)
	}
	throw new Response(null, { status: 404 })
}
