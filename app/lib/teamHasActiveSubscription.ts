import { TeamSubscription } from '~/schema'

type Team = { subscription: TeamSubscription | null }

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
