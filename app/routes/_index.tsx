import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { Await, defer, json, Link, useLoaderData } from '@remix-run/react'
import { Button } from '~/components/ui/button'
import { Suspense } from 'react'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import Nav from '~/components/ui/nav'
import { count, eq, sql } from 'drizzle-orm'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'
import { useMixpanelIdentify } from '~/lib/useMixpanelIdentify'
import HomeLandingPage from '~/components/home-landing-page'
import { players, statEntries, teams } from '~/schema'

export const meta: MetaFunction = () => {
	const price = 19
	const appName = 'TeamStats'
	const title = `${appName} - Straightforward Soccer Team Stats Tracking. $${price}/year`
	const description = `Track your soccer team's stats with beautiful visualizations, shareable leaderboards, and AI-powered schedule import. $${price}/year.`
	const author = 'Tyler Weeres'

	return [
		{
			title,
		},
		{
			name: 'description',
			content: `${description}`,
		},
		{
			tagName: 'link',
			rel: 'canonical',
			href: 'https://teamstats.tweeres.com',
		},

		// Open Graph tags
		{
			property: 'og:title',
			content: title,
		},
		{
			property: 'og:description',
			content: description,
		},
		{
			property: 'og:type',
			content: 'website',
		},
		{
			property: 'og:image',
			content: 'https://teamstats.tweeres.com/opengraph.png',
		},

		// Structured Data
		{
			'script:ld+json': {
				'@context': 'https://schema.org',
				'@type': 'SoftwareApplication',
				name: appName,
				description: description,
				applicationCategory: 'SportsApplication',
				operatingSystem: 'Any',
				offers: {
					'@type': 'Offer',
					price,
					priceCurrency: 'USD',
					frequency: 'yearly',
				},
				author: {
					'@type': 'Person',
					name: author,
				},
			},
		},
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await authenticator.isAuthenticated(request)

	const db = getDb()

	if (!user) {
		const allTeamsWithStatCounts = await db
			.select({
				id: teams.id,
				statCount: count(statEntries.id),
			})
			.from(teams)
			.innerJoin(players, eq(players.teamId, teams.id))
			.innerJoin(statEntries, eq(statEntries.playerId, players.id))
			.groupBy(teams.id)

		const teamCount = allTeamsWithStatCounts.length
		const statCount = allTeamsWithStatCounts.reduce(
			(acc, t) => acc + t.statCount,
			0
		)

		return json({ teamCount, statCount })
	}

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
	const loaderData = useLoaderData<typeof loader>()

	useMixpanelIdentify(loaderData.user)

	if (!loaderData.user) {
		return <HomeLandingPage {...loaderData} />
	}

	const { user, teams, stats } = loaderData

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
