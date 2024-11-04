import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { statEntries } from '~/schema'

async function handlePatch(request: Request, statId: string) {
	const formData = await request.formData()

	const timestamp = formData.get('timestamp')

	if (typeof timestamp !== 'string') {
		throw new Response('Timestamp is required', { status: 400 })
	}

	const db = getDb()

	return db
		.update(statEntries)
		.set({
			timestamp,
		})
		.where(eq(statEntries.id, Number(statId)))
}

async function handleDelete(statId: string) {
	const db = getDb()
	return db.delete(statEntries).where(eq(statEntries.id, Number(statId)))
}

export async function action({ params, request }: ActionFunctionArgs) {
	if (
		request.method.toLowerCase() !== 'patch' &&
		request.method.toLowerCase() !== 'delete'
	) {
		throw new Response(null, { status: 404 })
	}

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const { statId } = params

	invariant(statId, 'No stat ID')

	const stat = await db.query.statEntries.findFirst({
		where: (statEntries, { eq }) => eq(statEntries.id, Number(statId)),
		with: {
			player: true,
		},
	})

	invariant(stat, 'Stat not found')

	const userHasAccessToTeam = await hasAccessToTeam(user, stat.player.teamId)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	if (request.method.toLowerCase() === 'patch') {
		return handlePatch(request, statId)
	}

	if (request.method.toLowerCase() === 'delete') {
		return handleDelete(statId)
	}

	invariant(false, 'Should not reach here')
}
