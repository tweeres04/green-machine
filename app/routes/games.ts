import { ActionFunctionArgs } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { games } from '~/schema'
import { mixpanelServer } from '~/lib/mixpanel.server'

export async function action({ request }: ActionFunctionArgs) {
	if (request.method.toLowerCase() !== 'post') {
		throw new Response(null, { status: 404 })
	}

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const formData = await request.formData()

	const teamId = formData.get('team_id')

	invariant(typeof teamId === 'string', 'No teamId')

	const userHasAccessToTeam = await hasAccessToTeam(user, Number(teamId))

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	const timestamp = formData.get('timestamp')
	const opponent = formData.get('opponent')
	const location = formData.get('location')

	if (typeof opponent !== 'string') {
		throw new Response('Opponent is required', { status: 400 })
	}

	await db.insert(games).values({
		teamId,
		timestamp,
		opponent,
		location,
	})

	mixpanelServer.track('add game', {
		distinct_id: user.id,
		'team id': Number(teamId),
	})

	return null
}
