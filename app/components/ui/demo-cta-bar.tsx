import { useEffect, useRef } from 'react'
import { Link } from '@remix-run/react'
import mixpanel from 'mixpanel-browser'

import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'

export function DemoCtaBar({ teamSlug }: { teamSlug: string }) {
	const cardRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		cardRef.current?.classList.remove('translate-y-full')
	}, [])

	return (
		<Card
			className="fixed bottom-0 w-full max-w-[700px] mx-auto z-10 -m-2 translate-y-full transition-transform duration-700 ease-out" // max-w-[700px] is the same as the root layout
			ref={cardRef}
		>
			<CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
				<p className="grow text-sm">This is a real team using TeamStats.</p>
				<div className="space-y-1 text-center">
					<Button asChild className="w-full sm:w-auto">
						<Link
							to="/teams/new"
							onClick={() => {
								mixpanel.track('click create my team from demo', { teamSlug })
							}}
						>
							Get yours started in 2 minutes
						</Link>
					</Button>
					<small className="block text-xs font-light">
						Free for your first 3 games.
					</small>
				</div>
			</CardContent>
		</Card>
	)
}
