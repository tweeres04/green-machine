import { ActionFunctionArgs } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { players } from '~/schema'
import { inviteUser } from '~/lib/inviteUser'

export async function action({
	request,
	params: { teamId },
}: ActionFunctionArgs) {
	invariant(teamId, 'Missing teamId parameter')

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const userHasAccessToTeam = await hasAccessToTeam(user, Number(teamId))

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	const formData = await request.formData()
	const name = formData.get('name')
	const email = formData.get('email')

	if (typeof name !== 'string') {
		throw new Response('Name is required', { status: 400 })
	}

	return db.transaction(async (tx) => {
		const newPlayers = await tx
			.insert(players)
			.values({ name, teamId: Number(teamId) })
			.returning()
		const newPlayer = newPlayers[0]

		if (email && typeof email === 'string') {
			inviteUser({
				email,
				playerId: newPlayer.id,
				userId: user.id,
				inviterName: user.name,
				teamId: Number(teamId),
			})
		}

		return null
	})
}
