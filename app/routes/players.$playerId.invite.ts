import { ActionFunctionArgs } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { inviteUser } from '~/lib/inviteUser'

export async function action({ params, request }: ActionFunctionArgs) {
	const playerId = params.playerId

	invariant(playerId, 'No player ID')

	const db = getDb()

	const [user, player] = await Promise.all([
		authenticator.isAuthenticated(request),
		db.query.players.findFirst({
			where: (players, { eq }) => eq(players.id, Number(params.playerId)),
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
	const email = formData.get('email')

	if (!email || typeof email !== 'string') {
		throw new Response('Email is required', { status: 400 })
	}

	inviteUser({
		email,
		playerId: player.id,
		userId: user.id,
		inviterName: user.name,
		teamId: player.teamId,
	})

	return null
}
