import { Alert, AlertDescription } from '~/components/ui/alert'
import { FREE_GAMES_LIMIT } from '~/lib/teamHasActiveSubscription'
import { Button } from './button'

interface TrialStatusProps {
	teamId: number
	gamesWithStatsCount: number
	hasActiveSubscription: boolean
}

export function TrialStatus({
	teamId,
	gamesWithStatsCount,
	hasActiveSubscription,
}: TrialStatusProps) {
	// Don't show anything for subscribed teams
	if (hasActiveSubscription) {
		return null
	}

	const atLimit = gamesWithStatsCount >= FREE_GAMES_LIMIT

	const getMessage = () => {
		if (gamesWithStatsCount === 0) {
			return 'Your first 3 games are free. Subscribe to track your whole season.'
		} else if (!atLimit) {
			return `You've tracked ${gamesWithStatsCount} of 3 free games. Subscribe to keep the stats coming.`
		} else {
			return "Your team's off to a great start! Subscribe for $19/year to keep tracking every goal."
		}
	}

	const buttonText = atLimit ? 'Subscribe' : 'Subscribe for $19/year'

	return (
		<Alert>
			<AlertDescription className="space-y-3">
				<p>{getMessage()}</p>
				<div className="space-y-1">
					<Button asChild variant={atLimit ? 'default' : 'secondary'}>
						<a href={`/teams/${teamId}/subscribe`} className="underline font-medium">
							{buttonText}
						</a>
					</Button>
					{atLimit && <p className="text-xs text-center">Cancel anytime</p>}
				</div>
			</AlertDescription>
		</Alert>
	)
}
