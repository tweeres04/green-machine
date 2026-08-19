import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { games } from '~/schema'

async function handlePut(gameId: string, formData: FormData) {
	const db = getDb()

	const timestamp = formData.get('timestamp')
	const opponent = formData.get('opponent')
	const location = formData.get('location')

	if (
		(timestamp !== null && typeof timestamp !== 'string') ||
		(opponent !== null && typeof opponent !== 'string') ||
		(location !== null && typeof location !== 'string')
	) {
		throw new Response('Invalid form data', { status: 400 })
	}

	// Blank fields become null so the UI shows its TBD fallbacks instead of
	// empty strings
	return db
		.update(games)
		.set({
			timestamp,
			opponent: opponent || null,
			location: location || null,
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

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const game = await db.query.games.findFirst({
		where: (games, { eq }) => eq(games.id, Number(gameId)),
	})

	if (!game) {
		throw new Response(null, { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, game.teamId)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	if (request.method.toLowerCase() === 'put') {
		const formData = await request.formData()
		return handlePut(gameId, formData)
	} else if (request.method.toLowerCase() === 'patch') {
		const formData = await request.formData()
		return handlePatch(gameId, formData)
	}
	throw new Response(null, { status: 404 })
}
