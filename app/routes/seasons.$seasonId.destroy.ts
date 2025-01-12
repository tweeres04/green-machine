import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { getDb } from '~/lib/getDb'
import { seasons } from '~/schema'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import invariant from 'tiny-invariant'

export async function action({ request, params }: ActionFunctionArgs) {
	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const season = await db.query.seasons.findFirst({
		columns: {
			teamId: true,
		},
		where: (seasons, { eq }) => eq(seasons.id, Number(params.seasonId)),
	})

	invariant(season, 'Season not found')

	const teamId = season.teamId

	const userHasAccessToTeam = await hasAccessToTeam(user, Number(teamId))

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	return db.delete(seasons).where(eq(seasons.id, Number(params.seasonId)))
}
