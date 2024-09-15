import { ActionFunction, redirect } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { teams } from '~/schema'

export const action: ActionFunction = async ({ request }) => {
	const formData = await request.formData()
	const name = formData.get('name')
	const slug = formData.get('slug')

	if (typeof name !== 'string' || typeof slug !== 'string') {
		return redirect('/', { status: 400, statusText: 'Invalid form' })
	}

	const db = getDb()

	await db.insert(teams).values({
		name: name,
		slug: slug,
	})

	return redirect(`/${slug}`)
}
