import { json, LoaderFunctionArgs } from '@remix-run/node'
import { getDb } from '~/lib/getDb'

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const slug = url.searchParams.get('slug')

	if (!slug) return json({ slugIsAvailable: false })

	const db = getDb()
	const existingTeam = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, slug),
	})

	return json({ slugIsAvailable: !existingTeam })
}
