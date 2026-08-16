import { useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'

import { Button } from './button'

export function SupportBanner({ expiresAt }: { expiresAt: number }) {
	const fetcher = useFetcher()
	// Starts null so the server and the first client render agree. Date.now()
	// during render would differ between the two and break hydration
	const [remaining, setRemaining] = useState<number | null>(null)

	useEffect(() => {
		function tick() {
			setRemaining(expiresAt - Date.now())
		}

		tick()

		const interval = setInterval(tick, 1000)

		return () => clearInterval(interval)
	}, [expiresAt])

	if (remaining !== null && remaining <= 0) {
		return null
	}

	const minutes = remaining === null ? null : Math.floor(remaining / 60000)
	const seconds =
		remaining === null ? null : Math.floor((remaining % 60000) / 1000)

	return (
		<div className="bg-red-900 text-white">
			<div className="max-w-[700px] mx-auto flex items-center gap-3 p-2">
				<span className="grow text-sm">
					Support access
					{minutes === null
						? null
						: `, ${minutes}:${String(seconds).padStart(2, '0')} left`}
				</span>
				<fetcher.Form action="/support/drop" method="post">
					<Button size="sm" variant="secondary">
						End now
					</Button>
				</fetcher.Form>
			</div>
		</div>
	)
}
