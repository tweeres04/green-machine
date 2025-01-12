import { ActionFunctionArgs, json } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { seasons } from '~/schema'
import { z } from 'zod'

// The version of drizzle-zod I'm using doesn't seem to have an insert schema function
const SeasonSchema = z.object({
	name: z.string(),
	startDate: z.string().date(),
	endDate: z.string().date(),
})

async function handlePut(seasonId: string, formData: FormData) {
	const db = getDb()

	const result = SeasonSchema.safeParse(Object.fromEntries(formData))

	if (!result.success) {
		throw json(result.error.format(), { status: 400 })
	}

	return db
		.update(seasons)
		.set(result.data)
		.where(eq(seasons.id, Number(seasonId)))
}

export async function action({ params, request }: ActionFunctionArgs) {
	const { seasonId } = params

	invariant(seasonId, 'No seasonId')

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const season = await db.query.seasons.findFirst({
		where: (seasons, { eq }) => eq(seasons.id, Number(seasonId)),
		with: {
			team: {
				with: {
					subscription: true,
				},
			},
		},
	})

	if (!season) {
		throw new Response(null, { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, season.teamId)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	if (request.method.toLowerCase() === 'put') {
		const formData = await request.formData()
		return handlePut(seasonId, formData)
	}
	throw new Response(null, { status: 404 })
}
