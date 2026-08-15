import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { statEntries } from '~/schema'

async function handleDelete(statId: number) {
	const db = getDb()
	return db.delete(statEntries).where(eq(statEntries.id, statId))
}

export async function action({ params, request }: ActionFunctionArgs) {
	if (request.method.toLowerCase() !== 'delete') {
		throw new Response(null, { status: 404 })
	}

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const statId = Number(params.statId)

	// The id comes off the URL, so a non-numeric one is a bad request rather
	// than a broken assumption. NaN would reach the driver as a bind error.
	if (!Number.isInteger(statId)) {
		throw new Response('Stat not found', { status: 404 })
	}

	const stat = await db.query.statEntries.findFirst({
		where: (statEntries, { eq }) => eq(statEntries.id, statId),
		with: {
			player: true,
		},
	})

	if (!stat) {
		throw new Response('Stat not found', { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, stat.player.teamId)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	return handleDelete(statId)
}
