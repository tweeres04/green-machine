import { ActionFunction, redirect } from '@remix-run/node'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { teams, teamsUsers } from '~/schema'

export const action: ActionFunction = async ({ request }) => {
	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response('Not authorized', { status: 401 })
	}

	const formData = await request.formData()
	const name = formData.get('name')
	const slug = formData.get('slug')

	if (typeof name !== 'string' || typeof slug !== 'string') {
		throw new Response('Invalid form', {
			status: 400,
			statusText: 'Invalid form',
		})
	}

	const db = getDb()

	await db.transaction(async (tx) => {
		const newTeamRows = await tx
			.insert(teams)
			.values({
				name: name,
				slug: slug,
			})
			.returning()
		await tx.insert(teamsUsers).values({
			teamId: newTeamRows[0].id,
			userId: user.id,
		})
	})

	return redirect(`/${slug}`)
}
