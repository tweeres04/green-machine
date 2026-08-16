import { captureRemixErrorBoundaryError, withSentry } from "@sentry/remix";
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteError,
	useRouteLoaderData,
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
import { SupportBanner } from '~/components/ui/support-banner'

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
	const fbPixelId = process.env.FB_PIXEL_ID ?? null

	// Follows you around rather than being scoped to the team page, so you
	// can't forget it's running
	const supportElevation = user ? elevationFor(user.id) : null

	return json({
		color: team?.color ?? 'gray',
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
				{/* Meta Pixel is bootstrapped post-hydration in useFacebookPixel */}
			</body>
		</html>
	)
}

function App() {
	return <Outlet />
}

export default withSentry(App);

export function ErrorBoundary() {
    const error = useRouteError()
    console.error(error)
    captureRemixErrorBoundaryError(error);
    return (
		<html lang="en">
			<head>
				<title>There was an unexpected error</title>
				<Meta />
				<Links />
			</head>
			<body>
				Whoops, there was an unexpected error
				<Scripts />
			</body>
		</html>
	)
}