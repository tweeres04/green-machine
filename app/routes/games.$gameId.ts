import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { games, TeamSubscription } from '~/schema'
import { activeSubscription } from '~/lib/teamHasActiveSubscription'

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

async function handlePatch(
	gameId: string,
	formData: FormData,
	subscription: TeamSubscription | null
) {
	const db = getDb()

	// Only subscribed teams can cancel games
	if (!activeSubscription(subscription)) {
		throw new Response('Subscription required', { status: 402 })
	}

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
		with: {
			team: {
				with: {
					subscription: true,
				},
			},
		},
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
		return handlePatch(gameId, formData, game.team?.subscription)
	}
	throw new Response(null, { status: 404 })
}
