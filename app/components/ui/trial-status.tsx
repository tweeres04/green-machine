import { Alert, AlertDescription } from '~/components/ui/alert'
import { FREE_GAMES_LIMIT } from '~/lib/teamHasActiveSubscription'
import { Button } from './button'

interface TrialStatusProps {
	teamId: number
	gamesWithStatsCount: number
	hasActiveSubscription: boolean
	userHasAccessToTeam: boolean
}

export function TrialStatus({
	teamId,
	gamesWithStatsCount,
	hasActiveSubscription,
	userHasAccessToTeam,
}: TrialStatusProps) {
	// Don't show anything for subscribed teams
	if (hasActiveSubscription) {
		return null
	}

	// Players who aren't on the team can't subscribe, so pitching them a
	// Subscribe button just gives them a button that won't work
	if (!userHasAccessToTeam) {
		return null
	}

	const atLimit = gamesWithStatsCount >= FREE_GAMES_LIMIT

	// Only rendered once stats exist, so there's no zero-games message
	return (
		<Alert>
			<AlertDescription className="space-y-3">
				{atLimit ? (
					<>
						<p className="font-semibold">
							Your leaderboard is looking fresh ✨
						</p>
						<p>
							{`That's your 3 free games tracked. Subscribe to keep it going.`}
						</p>
					</>
				) : (
					<p>
						{`You've tracked ${gamesWithStatsCount} of 3 free games. Subscribe to keep the stats coming.`}
					</p>
				)}
				<p className="text-sm">
					<span className="font-semibold">Early access pricing, 50% off:</span>{' '}
					<span className="text-muted-foreground line-through">$39</span>{' '}
					<span className="font-medium">$19/year</span>
				</p>
				<div className="space-y-1">
					<Button asChild variant={atLimit ? 'default' : 'secondary'}>
						<a
							href={`/teams/${teamId}/subscribe`}
							className="underline font-medium"
						>
							Subscribe
						</a>
					</Button>
					{atLimit && <p className="text-xs text-center">Cancel anytime</p>}
				</div>
			</AlertDescription>
		</Alert>
	)
}
