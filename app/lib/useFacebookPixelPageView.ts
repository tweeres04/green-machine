import { useLocation } from '@remix-run/react'
import { useEffect, useRef } from 'react'

declare global {
	interface Window {
		fbq?: (...args: unknown[]) => void
	}
}

export function useFacebookPixelPageView(fbPixelId: string | null) {
	const { pathname, search } = useLocation()
	const firstRender = useRef(true)

	useEffect(() => {
		if (!fbPixelId) return
		if (firstRender.current) {
			firstRender.current = false
			return
		}
		window.fbq?.('track', 'PageView')
	}, [fbPixelId, pathname, search])
}
