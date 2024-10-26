import { ActionFunctionArgs, redirect } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { getDb } from '~/lib/getDb'
import { games } from '~/schema'

export async function action({ request }: ActionFunctionArgs) {
	if (request.method.toLowerCase() !== 'post') {
		throw new Response(null, { status: 404 })
	}

	const db = getDb()

	const formData = await request.formData()

	const teamSlug = formData.get('team_slug')
	const teamId = formData.get('team_id')

	invariant(typeof teamId === 'string', 'No teamId')
	invariant(typeof teamSlug === 'string', 'No teamSlug')

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

	return redirect(`/${teamSlug}/games`)
}
