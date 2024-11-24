/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import { RemixBrowser } from '@remix-run/react'
import { startTransition, StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import mixpanel from 'mixpanel-browser'

declare global {
	interface Window {
		mixpanelToken: string
	}
}

mixpanel.init(window.mixpanelToken, {
	debug: true,
	track_pageview: 'url-with-path-and-query-string',
	persistence: 'localStorage',
})

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<RemixBrowser />
		</StrictMode>
	)
})
