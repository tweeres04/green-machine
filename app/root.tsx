import { captureRemixErrorBoundaryError, withSentry } from '@sentry/remix'
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	isRouteErrorResponse,
	useRouteError,
	useRouteLoaderData,
	type ShouldRevalidateFunctionArgs,
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
import { useFacebookPixel } from '~/lib/useFacebookPixel'
import { elevationFor } from '~/lib/support.server'
import { requireCanonicalSlug, slugEquals } from '~/lib/team-slug.server'
import { SupportBanner } from '~/components/ui/support-banner'
import Nav from '~/components/ui/nav'
import { sql } from 'drizzle-orm'
import { SidebarProvider } from '~/components/ui/sidebar'
import { AppSidebar } from '~/components/ui/app-sidebar'

// The sidebar's team links navigate between teams client-side, which leaves
// this loader's team-scoped data (team, color, sidebar contents) stale:
// Remix only revalidates a route when its own params change, and the root
// route has none. Revalidate whenever the path changes instead
export function shouldRevalidate({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
	return currentUrl.pathname !== nextUrl.pathname || defaultShouldRevalidate
}

export async function loader({
	params: { teamSlug },
	request,
}: LoaderFunctionArgs) {
	const db = getDb()

	const [user, team] = await Promise.all([
		authenticator.isAuthenticated(request),
		teamSlug
			? db.query.teams.findFirst({
					where: () => slugEquals(teamSlug),
					columns: { id: true, color: true, slug: true, name: true },
			  })
			: Promise.resolve(null),
	])

	// Every HTML team route renders through here, so one check covers them all.
	// Resource routes like the og images don't run this loader, which is fine:
	// nothing shares those URLs by hand
	if (teamSlug && team) {
		requireCanonicalSlug(request, teamSlug, team.slug)
	}

	const [userHasAccessToTeam, userTeams] = await Promise.all([
		team ? hasAccessToTeam(user, Number(team.id)) : false,
		user
			? (db.all(sql`
					select distinct teams.id, teams.name, teams.slug
					from teams
						left join users_teams on teams.id = users_teams.team_id
						left join players on teams.id = players.team_id
						left join user_invites on user_invites.player_id = players.id
					where
						users_teams.user_id = ${user.id} or user_invites.user_id = ${user.id}
					order by teams.name
				`) as Promise<{ id: number; name: string; slug: string }[]>)
			: ([] as { id: number; name: string; slug: string }[]),
	])

	invariant(process.env.MIXPANEL_TOKEN, 'MIXPANEL_TOKEN missing in .env')
	const mixpanelToken = process.env.MIXPANEL_TOKEN
	const fbPixelId = process.env.FB_PIXEL_ID ?? null

	// Follows you around rather than being scoped to the team page, so you
	// can't forget it's running
	const supportElevation = user ? elevationFor(user.id) : null

	return json({
		color: team?.color ?? 'gray',
		team: team ?? null,
		userTeams,
		user,
		userHasAccessToTeam,
		mixpanelToken,
		fbPixelId,
		supportElevation,
	})
}

export function Layout({ children }: { children: React.ReactNode }) {
	// Error pages render Layout without loader data, and useLoaderData throws in
	// that case. useRouteLoaderData returns undefined instead, so every value
	// needs a fallback for the error page to render
	const {
		color = 'gray',
		team = null,
		userTeams = [],
		user = null,
		userHasAccessToTeam = false,
		mixpanelToken = '',
		fbPixelId = null,
		supportElevation = null,
	} = useRouteLoaderData<typeof loader>('root') ?? {}

	useMixpanelIdentify(user)
	useFacebookPixel(fbPixelId ?? null)

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				{/* Browsers cached the pre-trophy manifest with a 1 year immutable
				    max-age, so the URL has to change for them to refetch it */}
				<link rel="manifest" href="/manifest.json?v=2" />
				<link rel="icon" href="/favicon.ico" sizes="32x32" />
				<link rel="icon" href="/teamstats-logo.svg" type="image/svg+xml" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
				{supportElevation ? (
					<SupportBanner expiresAt={supportElevation.expiresAt} />
				) : null}
				<script
					dangerouslySetInnerHTML={{
						__html: `window.mixpanelToken = "${mixpanelToken}"`,
					}}
				/>
				<TeamColorContext.Provider value={color}>
					<UserContext.Provider
						value={user ? { user, userHasAccessToTeam } : null}
					>
						<SidebarProvider defaultOpen={false}>
							{/* w-full because the provider makes this a flex item, which
							    would otherwise shrink to fit its content */}
							<div className="max-w-[700px] mx-auto space-y-8 p-2 relative w-full">
								{children}
							</div>
							<AppSidebar team={team} userTeams={userTeams} />
						</SidebarProvider>
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
				{/* Meta Pixel is bootstrapped post-hydration in useFacebookPixel */}
			</body>
		</html>
	)
}

function App() {
	return <Outlet />
}

export default withSentry(App)

export function ErrorBoundary() {
	const error = useRouteError()
	const notFound = isRouteErrorResponse(error) && error.status === 404

	// A 404 is a normal outcome, not something to page us about. Everything
	// else still reports
	if (!notFound) {
		console.error(error)
		captureRemixErrorBoundaryError(error)
	}

	// Remix renders this inside the Layout export, so it returns page content
	// rather than a second html document
	return (
		<div className="space-y-3">
			{/* Both Nav props are optional, so it renders fine without a team and
			    gives people a way off the error page */}
			<Nav title="TeamStats" />
			<h1 className="text-2xl">
				{notFound ? "We couldn't find that page" : 'Something went wrong'}
			</h1>
			{notFound ? (
				<>
					<p>
						{`That team doesn't exist, or its address changed after the link was shared.`}
					</p>
					<p>
						<a href="/" className="underline">
							Go to your teams
						</a>
					</p>
				</>
			) : (
				<p>
					{`Sorry about that. Try again. If it keeps happening, let me know.`}
				</p>
			)}
		</div>
	)
}
