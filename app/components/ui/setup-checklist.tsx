import { Link } from '@remix-run/react'
import { Circle, CircleCheck, UserPlus } from 'lucide-react'
import { ReactNode } from 'react'
import { Button } from '~/components/ui/button'

function ChecklistItem({
	done,
	children,
}: {
	done: boolean
	children: ReactNode
}) {
	return (
		<li className="flex items-start gap-2">
			{done ? (
				<CircleCheck className="size-5 shrink-0 mt-1" />
			) : (
				<Circle className="size-5 shrink-0 mt-1 opacity-40" />
			)}
			<span className={done ? 'line-through opacity-70' : undefined}>
				{children}
			</span>
		</li>
	)
}

// Shows until the first stats are logged, then TrialStatus takes over that
// spot. The last item is the exit condition, so it's never seen checked
export function SetupChecklist({
	teamSlug,
	hasPlayers,
	hasFutureGame,
	hasCustomizedSettings,
}: {
	teamSlug: string
	hasPlayers: boolean
	hasFutureGame: boolean
	hasCustomizedSettings: boolean
}) {
	return (
		<div className="space-y-3">
			<h2 className="text-2xl">Get your team set up</h2>
			<ul className="space-y-2">
				<ChecklistItem done={hasPlayers}>
					<Link to={`/${teamSlug}/players`} className="underline">
						Add your players
					</Link>
				</ChecklistItem>
				<ChecklistItem done={hasFutureGame}>
					<Link to={`/${teamSlug}/games`} className="underline">
						Add your next game or import your schedule
					</Link>{' '}
					(optional, shows your next game with the weather)
				</ChecklistItem>
				<ChecklistItem done={hasCustomizedSettings}>
					<Link to={`/${teamSlug}/settings`} className="underline">
						Pick your color and location in settings
					</Link>{' '}
					(optional, location adds weather to your games)
				</ChecklistItem>
				<ChecklistItem done={false}>
					Add goals and assists after your first game
				</ChecklistItem>
			</ul>
			{hasPlayers ? null : (
				<Button asChild>
					<Link to={`/${teamSlug}/players`}>
						<UserPlus />
						Add your players
					</Link>
				</Button>
			)}
		</div>
	)
}
