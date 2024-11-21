import { TeamSubscription, Team as TeamType } from '~/schema'

type Team = TeamType & { subscription: TeamSubscription | null }

export function teamHasActiveSubscription(team: Team) {
	return (
		team.subscription &&
		(team.subscription.subscriptionStatus !== 'canceled' &&
			team.subscription.subscriptionStatus) !== 'unpaid'
	)
}
