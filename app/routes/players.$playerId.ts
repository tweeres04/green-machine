import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { players } from '~/schema'

export async function action({ params, request }: ActionFunctionArgs) {
	const { playerId } = params

	invariant(playerId, 'Missing playerId parameter')

	if (request.method.toLowerCase() !== 'put') {
		throw new Response(null, { status: 404 })
	}

	const db = getDb()

	const [user, player] = await Promise.all([
		authenticator.isAuthenticated(request),
		db.query.players.findFirst({
			where: (players, { eq }) => eq(players.id, Number(playerId)),
		}),
	])

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	if (!player) {
		throw new Response(null, { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, player.teamId)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	const formData = await request.formData()
	const name = formData.get('name')

	if (typeof name !== 'string' || name === '') {
		throw new Response('Invalid form data', { status: 400 })
	}

	await db.update(players).set({ name }).where(eq(players.id, player.id))

	return null
}
