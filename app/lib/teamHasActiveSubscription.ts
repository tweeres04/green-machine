import { TeamSubscription, Team as TeamType } from '~/schema'

type Team = TeamType & { subscription: TeamSubscription | null }

export function teamHasActiveSubscription(team: Team) {
	return activeSubscription(team.subscription)
}

export function activeSubscription(
	teamSubscription: TeamSubscription | null | undefined
) {
	return (
		teamSubscription &&
		teamSubscription.subscriptionStatus !== 'canceled' &&
		teamSubscription.subscriptionStatus !== 'unpaid'
	)
}
