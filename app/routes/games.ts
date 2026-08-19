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

	if (
		(timestamp !== null && typeof timestamp !== 'string') ||
		(opponent !== null && typeof opponent !== 'string') ||
		(location !== null && typeof location !== 'string')
	) {
		throw new Response('Invalid form data', { status: 400 })
	}

	// Blank fields become null so the UI shows its TBD fallbacks instead of
	// empty strings
	await db.insert(games).values({
		teamId: Number(teamId),
		timestamp,
		opponent: opponent || null,
		location: location || null,
	})

	mixpanelServer.track('add game', {
		distinct_id: user.id,
		'team id': Number(teamId),
	})

	return null
}
