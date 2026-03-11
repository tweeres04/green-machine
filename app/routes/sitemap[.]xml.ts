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

	const staticPages = [
		'https://teamstats.tweeres.com',
		'https://teamstats.tweeres.com/privacy-policy',
		'https://teamstats.tweeres.com/terms-of-service',
		'https://teamstats.tweeres.com/contact',
	]

	const staticXml = staticPages
		.map((loc) => `\t<url>\n\t\t<loc>${loc}</loc>\n\t</url>`)
		.join('\n')

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
	${teamsXml}
</urlset>`

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
		},
	})
}
