import { TeamSubscription } from '~/schema'

type Team = { subscription: TeamSubscription | null }

export const FREE_GAMES_LIMIT = 3

export function teamHasActiveSubscription(team: Team) {
	return activeSubscription(team.subscription)
}

export function activeSubscription(
	teamSubscription: TeamSubscription | null | undefined
) {
	return (
		teamSubscription !== null &&
		teamSubscription !== undefined &&
		teamSubscription.subscriptionStatus !== 'canceled' &&
		teamSubscription.subscriptionStatus !== 'unpaid'
	)
}

/**
 * Determines if a team can add stats to a game based on their subscription
 * status and free trial usage.
 *
 * @param subscription - The team's subscription object
 * @param gamesWithStatsCount - Current count of games with stats
 * @param gameAlreadyHasStats - Whether the target game already has stats
 * @returns true if stats can be added, false otherwise
 */
export function canAddStatsToGame(
	subscription: TeamSubscription | null | undefined,
	gamesWithStatsCount: number,
	gameAlreadyHasStats: boolean
): boolean {
	// Paid teams can always add stats
	if (activeSubscription(subscription)) {
		return true
	}

	// Free teams can add stats to existing games with stats
	if (gameAlreadyHasStats) {
		return true
	}

	// Free teams can add stats to new games if under the limit
	return gamesWithStatsCount < FREE_GAMES_LIMIT
}
