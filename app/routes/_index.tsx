import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { Await, defer, Link, useLoaderData } from '@remix-run/react'
import { Button } from '~/components/ui/button'
import { Suspense } from 'react'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import Nav from '~/components/ui/nav'
import { sql } from 'drizzle-orm'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'
import { useMixpanelIdentify } from '~/lib/useMixpanelIdentify'

export const meta: MetaFunction = () => {
	return [
		{ title: 'TeamStats' },
		{
			name: 'description',
			content: 'Set up stats for your sports team',
		},
		{ name: 'robots', context: 'noindex' },
		{ taname: 'link', rel: 'canonical', href: 'https://teamstats.tweeres.com' },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await authenticator.isAuthenticated(request, {
		failureRedirect: '/login',
	})

	const db = getDb()

	const sql_ = sql`
		select distinct
			teams.id,
			teams.name,
			teams.slug,
			team_subscriptions.subscription_status subscriptionStatus
		from teams
			left join users_teams on teams.id = users_teams.team_id
			left join players players_for_users on teams.id = players_for_users.team_id
			left join user_invites on user_invites.player_id = players_for_users.id
			left join team_subscriptions on teams.id = team_subscriptions.team_id
		where
			users_teams.user_id = ${user.id} or user_invites.user_id = ${user.id}
		order by teams.name
	`

	const teams_ = await db.all(sql_)

	const teamIds = teams_.map((t) => t.id)

	const statsPromise = db.all(sql`
		select
			teams.id,
			teams.name,
			(
				select count(*)
				from stat_entries
					inner join players on stat_entries.player_id = players.id
				where team_id = teams.id
			) statCount,
			(
				select count(*)
				from players
				where team_id = teams.id
			) playerCount
		from teams
			inner join players on teams.id = players.team_id
		where
			teams.id in ${teamIds}
	`)

	return defer({ user, teams: teams_, stats: statsPromise })
}

export default function Index() {
	const { user, teams, stats } = useLoaderData<typeof loader>()

	useMixpanelIdentify(user)

	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<Nav title="My Teams" />
			{teams.length > 0 ? (
				<ul className="space-y-3">
					{teams.map((t) => {
						// Need to move this into the helper function at some point
						const noSubscription =
							!t.subscriptionStatus ||
							t.subscriptionStatus === 'canceled' ||
							t.subscriptionStatus === 'unpaid'
						return (
							<li key={t.id}>
								<Button
									asChild
									variant="link"
									className={cn('pl-0 gap-1', {
										'text-red-900': noSubscription,
									})}
								>
									<a href={`/${t.slug}`} className="text-xl">
										{t.name}{' '}
										{noSubscription ? (
											<Badge variant="secondary">No subscription</Badge>
										) : null}
									</a>
								</Button>
								<Suspense>
									<Await resolve={stats}>
										{(stats) => {
											const statsForTeam = stats.find((s) => s.id === t.id)
											return (
												<p>
													{statsForTeam?.playerCount ?? '0'} player
													{statsForTeam?.playerCount !== 1 && 's'},{' '}
													{statsForTeam?.statCount ?? '0'} stat
													{statsForTeam?.statCount !== 1 && 's'} recorded
												</p>
											)
										}}
									</Await>
								</Suspense>
							</li>
						)
					})}
				</ul>
			) : (
				<p>No teams yet. Create one to get started.</p>
			)}

			<Button asChild>
				<Link to="/teams/new">Create team</Link>
			</Button>
		</div>
	)
}
