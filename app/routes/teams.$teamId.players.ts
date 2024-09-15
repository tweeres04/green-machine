import { ActionFunctionArgs, redirect } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { getDb } from '~/lib/getDb'
import { players } from '~/schema'

export async function action({
	request,
	params: { teamId },
}: ActionFunctionArgs) {
	invariant(teamId, 'Missing teamId parameter')

	const db = getDb()

	const formData = await request.formData()
	const name = formData.get('name')
	const slug = formData.get('slug')

	invariant(slug, 'Missing slug field')

	if (typeof name !== 'string') {
		throw new Response('Name is required', { status: 400 })
	}

	await db.insert(players).values({ name, teamId: Number(teamId) })

	return redirect(`/${slug}?edit`)
}
