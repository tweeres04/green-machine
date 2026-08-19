import {
	init,
	replayIntegration,
	browserTracingIntegration,
} from '@sentry/remix'
/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import { RemixBrowser, useLocation, useMatches } from '@remix-run/react'
import { startTransition, StrictMode, useEffect } from 'react'
import { hydrateRoot } from 'react-dom/client'
import mixpanel from 'mixpanel-browser'

init({
	dsn: 'https://be220b42e1246adfa24c00c1e6917b15@o4504010497720320.ingest.us.sentry.io/4511094435414016',
	enabled: process.env.NODE_ENV === 'production',
	environment: process.env.NODE_ENV,
	tracesSampleRate: 1,
	enableLogs: true,

	// Zalo's in-app browser injects a script that references its own globals on
	// top of our pages. Not our code, and nothing we can fix
	ignoreErrors: [/zaloJSV2/],

	integrations: [
		browserTracingIntegration({
			useEffect,
			useLocation,
			useMatches,
		}),
		replayIntegration({
			maskAllText: false,
			blockAllMedia: false,
		}),
	],

	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1,
	sendDefaultPii: true,
})

declare global {
	interface Window {
		mixpanelToken: string
	}
}

mixpanel.init(window.mixpanelToken, {
	debug: process.env.NODE_ENV !== 'production',
	track_pageview: 'url-with-path',
	persistence: 'localStorage',
	record_sessions_percent: 100,
	record_heatmap_data: true,
	record_mask_all_text: false,
	record_mask_all_inputs: false,
})

// Super property on every event: was this session launched from the home
// screen? Tells us how much installed-app usage the install card earns
mixpanel.register({
	isStandalone: window.matchMedia('(display-mode: standalone)').matches,
})

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<RemixBrowser />
		</StrictMode>
	)
})
