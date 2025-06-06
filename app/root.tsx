import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from '@remix-run/react'

import '@fontsource-variable/nunito-sans'
import '~/tailwind.css'
import { json, LoaderFunctionArgs } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { TeamColorContext } from '~/lib/teamColorContext'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { UserContext } from '~/lib/userContext'
import invariant from 'tiny-invariant'
import { useMixpanelIdentify } from '~/lib/useMixpanelIdentify'

export async function loader({
	params: { teamSlug },
	request,
}: LoaderFunctionArgs) {
	const db = getDb()

	const [user, team] = await Promise.all([
		authenticator.isAuthenticated(request),
		teamSlug
			? db.query.teams.findFirst({
					where: (teams, { eq }) => eq(teams.slug, teamSlug),
					columns: { id: true, color: true },
			  })
			: Promise.resolve(null),
	])

	const userHasAccessToTeam = team
		? await hasAccessToTeam(user, Number(team.id))
		: false

	invariant(process.env.MIXPANEL_TOKEN, 'MIXPANEL_TOKEN missing in .env')
	const mixpanelToken = process.env.MIXPANEL_TOKEN

	return json({
		color: team?.color ?? 'gray',
		user,
		userHasAccessToTeam,
		mixpanelToken,
	})
}

export function Layout({ children }: { children: React.ReactNode }) {
	const { color, user, userHasAccessToTeam, mixpanelToken } =
		useLoaderData<typeof loader>() ?? {} // error pages like 404 don't allow for loader data

	useMixpanelIdentify(user)

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="manifest" href="/manifest.json" />
				<link rel="icon" href="/formation.png" type="image/png" />
				<Meta />
				<Links />
				<style
					dangerouslySetInnerHTML={{
						__html: `
						html {
							font-size: 20px;
						}
					`,
					}}
				></style>
			</head>
			<body className={`bg-${color}-50`}>
				<script
					dangerouslySetInnerHTML={{
						__html: `window.mixpanelToken = "${mixpanelToken}"`,
					}}
				/>
				<TeamColorContext.Provider value={color}>
					<UserContext.Provider
						value={user ? { user, userHasAccessToTeam } : null}
					>
						<div className="max-w-[700px] mx-auto space-y-8 p-2 relative">
							{children}
						</div>
					</UserContext.Provider>
				</TeamColorContext.Provider>
				<ScrollRestoration />
				<Scripts />
				{/* Simple analytics */}
				<script
					data-collect-dnt="true"
					async
					src="https://scripts.simpleanalyticscdn.com/latest.js"
				></script>
				{/* Ahrefs analytics */}
				<script
					src="https://analytics.ahrefs.com/analytics.js"
					data-key="OR25pSoDpycSw5Y6N2q99Q"
					async
				></script>
			</body>
		</html>
	)
}

export default function App() {
	return <Outlet />
}
