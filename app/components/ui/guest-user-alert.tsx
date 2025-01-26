import { X } from 'lucide-react'
import { useState, useContext, useEffect, useRef } from 'react'
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { TeamColorContext } from '~/lib/teamColorContext'
import { Link, useFetcher } from '@remix-run/react'

export function GuestUserAlert({
	teamId,
	userHasAccessToTeam,
	player,
	dismissed: initialDismissed,
}: {
	teamId: number
	userHasAccessToTeam: boolean
	player: boolean
	dismissed: boolean
}) {
	const [dismissed, setDismissed] = useState(initialDismissed)
	const teamColor = useContext(TeamColorContext)
	const fetcher = useFetcher()
	const cardRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		cardRef.current?.classList.remove('translate-y-full')
	}, [])

	if (dismissed || userHasAccessToTeam || player) return null

	return (
		<Card
			className="fixed bottom-0 w-full max-w-[700px] mx-auto z-10 -m-2 translate-y-full transition-transform duration-700 ease-out" // max-w-[700px] is the same as the root layout
			ref={cardRef}
		>
			<CardHeader>
				<CardTitle>Are you on this team?</CardTitle>
				<CardDescription>Players on this team can:</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="list-disc list-inside">
					<li>Always know the next game</li>
					<li>Quickly check team stats</li>
					<li>RSVP to games</li>
				</ul>
				<Button
					size="icon"
					variant="ghost"
					onClick={() => {
						setDismissed(true)
						fetcher.submit(null, {
							method: 'post',
							action: '/dismiss-guest-user-alert',
						})
					}}
					className={`absolute top-0 right-0 text-${teamColor}-500 dark:text-${teamColor}-400`}
				>
					<X />
				</Button>
			</CardContent>
			<CardFooter>
				<Button asChild>
					<Link to={`/request-invite?team_id=${teamId}`}>
						Request to be a player
					</Link>
				</Button>
			</CardFooter>
		</Card>
	)
}
