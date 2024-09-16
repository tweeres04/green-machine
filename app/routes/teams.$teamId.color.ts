import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { getDb } from '~/lib/getDb'
import { teams } from '~/schema'

export async function action({
	request,
	params: { teamId },
}: ActionFunctionArgs) {
	invariant(teamId, 'Missing teamId parameter')

	const db = getDb()

	const formData = await request.formData()
	const color = formData.get('color')

	if (typeof color !== 'string') {
		throw new Response('Color is required', { status: 400 })
	}

	return db
		.update(teams)
		.set({ color })
		.where(eq(teams.id, Number(teamId)))
}
