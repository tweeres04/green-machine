import { getDb } from '~/lib/getDb'

export async function loader() {
	const db = getDb()

	const teams = await db.query.teams.findMany({
		with: {
			subscription: true,
		},
	})

	const teamsXml = teams
		.map((t) =>
			t.subscription?.subscriptionStatus === 'active' ||
			t.subscription?.subscriptionStatus === 'trialing'
				? `	<url>
		<loc>https://teamstats.tweeres.com/${t.slug}</loc>
	</url>`
				: null
		)
		.filter(Boolean)

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url>
        <loc>https://teamstats.tweeres.com</loc>
    </url>
	${teamsXml}
</urlset>`

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
		},
	})
}
