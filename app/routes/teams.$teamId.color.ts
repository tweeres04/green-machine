import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { teams } from '~/schema'

export async function action({
	request,
	params: { teamId: teamIdParam },
}: ActionFunctionArgs) {
	const teamId = Number(teamIdParam)

	// Straight off the URL, so a non-numeric id is a bad request rather than
	// NaN reaching the driver as a bind error
	if (!Number.isInteger(teamId)) {
		throw new Response('Team not found', { status: 404 })
	}

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	if (!(await hasAccessToTeam(user, teamId))) {
		throw new Response(null, { status: 403 })
	}

	const db = getDb()

	const formData = await request.formData()
	const color = formData.get('color')

	if (typeof color !== 'string') {
		throw new Response('Color is required', { status: 400 })
	}

	return db.update(teams).set({ color }).where(eq(teams.id, teamId))
}
