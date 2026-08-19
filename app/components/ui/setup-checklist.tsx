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
	hasTeammates,
	userIsPlayer,
	hasFutureGame,
	hasCustomizedSettings,
}: {
	teamSlug: string
	hasTeammates: boolean
	userIsPlayer: boolean
	hasFutureGame: boolean
	hasCustomizedSettings: boolean
}) {
	// A creator who added themselves can already track their own stats, so
	// the ask shifts to rounding out the roster
	const addPlayersLabel = userIsPlayer
		? 'Add your teammates'
		: 'Add your players'

	return (
		<div className="space-y-3">
			<h2 className="text-2xl">Get your team set up</h2>
			<ul className="space-y-2">
				<ChecklistItem done={hasTeammates}>
					<Link to={`/${teamSlug}/players`} className="underline">
						{addPlayersLabel}
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
			{hasTeammates ? null : (
				<Button asChild>
					<Link to={`/${teamSlug}/players`}>
						<UserPlus />
						{addPlayersLabel}
					</Link>
				</Button>
			)}
		</div>
	)
}
