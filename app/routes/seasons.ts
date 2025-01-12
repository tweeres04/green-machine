import { ActionFunctionArgs, json } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { seasons } from '~/schema'
import { activeSubscription } from '~/lib/teamHasActiveSubscription'
import { createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'

const SeasonSchema = createInsertSchema(seasons, {
	teamId: z.coerce.number(),
})

export async function action({ request }: ActionFunctionArgs) {
	if (request.method.toLowerCase() !== 'post') {
		throw new Response(null, { status: 404 })
	}

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const formData = await request.formData()

	const teamId = formData.get('teamId')

	invariant(typeof teamId === 'string', 'No teamId')

	const [userHasAccessToTeam, subscription] = await Promise.all([
		hasAccessToTeam(user, Number(teamId)),
		db.query.teamSubscriptions.findFirst({
			where: (teamSubscriptions, { eq }) =>
				eq(teamSubscriptions.teamId, Number(teamId)),
		}),
	])

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	if (!activeSubscription(subscription)) {
		throw new Response('Subscription required', { status: 402 })
	}

	const result = SeasonSchema.safeParse(Object.fromEntries(formData))

	if (!result.success) {
		throw json(result.error.format(), { status: 400 })
	}

	return db.insert(seasons).values(result.data)
}
