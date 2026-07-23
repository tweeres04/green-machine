import { useLocation } from '@remix-run/react'
import { useEffect, useRef } from 'react'

type Fbq = {
	(...args: unknown[]): void
	callMethod?: (...args: unknown[]) => void
	queue: unknown[]
	push: Fbq
	loaded: boolean
	version: string
}

declare global {
	interface Window {
		fbq?: Fbq
		_fbq?: Fbq
	}
}

// Bootstrap the pixel after hydration instead of from SSR markup. When the
// snippet is server-rendered, fbevents.js inserts a script node into React's
// DOM mid-hydration, which fails hydration and strands streamed deferred data
// (the "Server timeout." crash, Sentry TEAMSTATS-6/TEAMSTATS-S).
function initFacebookPixel(fbPixelId: string) {
	if (window.fbq) return

	const fbq: Fbq = Object.assign(
		(...args: unknown[]) => {
			if (fbq.callMethod) {
				fbq.callMethod(...args)
			} else {
				fbq.queue.push(args)
			}
		},
		{
			queue: [] as unknown[],
			loaded: true,
			version: '2.0',
		}
	) as Fbq
	fbq.push = fbq

	window.fbq = fbq
	window._fbq = fbq

	const script = document.createElement('script')
	script.async = true
	script.src = 'https://connect.facebook.net/en_US/fbevents.js'
	document.head.appendChild(script)

	fbq('init', fbPixelId)
	fbq('track', 'PageView')
}

export function useFacebookPixelPageView(fbPixelId: string | null) {
	const { pathname, search } = useLocation()
	const firstRender = useRef(true)

	useEffect(() => {
		if (!fbPixelId) return
		if (firstRender.current) {
			firstRender.current = false
			initFacebookPixel(fbPixelId)
			return
		}
		window.fbq?.('track', 'PageView')
	}, [fbPixelId, pathname, search])
}
