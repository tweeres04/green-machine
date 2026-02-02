import { ActionFunction, redirect } from '@remix-run/node'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { teams, teamsUsers } from '~/schema'
import { LibsqlError } from '@libsql/client'
import { mixpanelServer } from '~/lib/mixpanel.server'

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

	let results
	try {
		results = await db.transaction(async (tx) => {
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

			return newTeamRows
		})
	} catch (error) {
		if (
			error instanceof LibsqlError &&
			error.code === 'SQLITE_CONSTRAINT_UNIQUE'
		) {
			throw new Response('Team URL already taken', { status: 409 })
		}
		throw error
	}

	const newTeam = results[0]

	mixpanelServer.track('Team created', {
		distinct_id: user.id,
		'team id': newTeam.id,
		'team name': newTeam.name,
		ip: 0,
	})

	// Redirect to the new team page (free trial starts automatically)
	return redirect(`/${newTeam.slug}`, { status: 303 })
}
