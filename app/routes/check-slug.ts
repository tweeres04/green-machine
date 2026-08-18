import { json, LoaderFunctionArgs } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { slugEquals } from '~/lib/team-slug.server'

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const slug = url.searchParams.get('slug')

	if (!slug) return json({ slugIsAvailable: false })

	const db = getDb()
	const existingTeam = await db.query.teams.findFirst({
		where: () => slugEquals(slug),
	})

	return json({ slugIsAvailable: !existingTeam })
}
