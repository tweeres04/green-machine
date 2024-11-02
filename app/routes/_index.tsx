import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { Await, defer, Form, useLoaderData } from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { kebabCase } from 'lodash-es'
import React, { Suspense } from 'react'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import Nav from '~/components/ui/nav'
import { sql } from 'drizzle-orm'
import {
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogContent,
} from '~/components/ui/dialog'
import invariant from 'tiny-invariant'

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

function NewTeamForm() {
	const nameRef = React.useRef<HTMLInputElement>(null)
	const slugRef = React.useRef<HTMLInputElement>(null)
	useAutoSlug(nameRef, slugRef)

	return (
		<Form method="post" action="/teams">
			<div className="space-y-4">
				<div>
					<label htmlFor="name">Team Name</label>
					<Input type="text" name="name" id="name" required ref={nameRef} />
				</div>

				<div>
					<label htmlFor="slug">Slug</label>
					<Input type="text" name="slug" id="slug" required ref={slugRef} />
					<p className="text-sm">
						ex: teamstats.tweeres.com/<strong>my-slug</strong>
					</p>
				</div>

				<div className="space-x-2">
					<Button type="button" variant="secondary">
						Cancel
					</Button>
					<Button type="submit">Create Team</Button>
				</div>
			</div>
		</Form>
	)
}

function useAutoSlug(
	nameRef: React.RefObject<HTMLInputElement>,
	slugRef: React.RefObject<HTMLInputElement>
) {
	const [edited, setEdited] = React.useState(false)

	React.useEffect(() => {
		if (!slugRef.current) return

		slugRef.current.addEventListener('input', () => {
			setEdited(true)
		})
	}, [slugRef])

	React.useEffect(() => {
		if (!slugRef.current || !nameRef.current) return

		const nameInput = nameRef.current
		const slugInput = slugRef.current

		function updateSlug() {
			if (edited) return

			const slug = kebabCase(nameInput.value)
			slugInput.value = slug
		}

		nameInput.addEventListener('input', updateSlug)

		return () => {
			nameInput?.removeEventListener('input', updateSlug)
		}
	}, [edited, nameRef, slugRef])
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
			teams.slug
		from teams
			left join users_teams on teams.id = users_teams.team_id
			left join players players_for_users on teams.id = players_for_users.team_id
			left join user_invites on user_invites.player_id = players_for_users.id
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

	return defer({ teams: teams_, stats: statsPromise })
}

type Team = {
	id: number
	name: string
	slug: string
	playerCount: number
	statCount: number
}

type Stats = {
	id: number
	playerCount: number
	statCount: number
}

export default function Index() {
	const { teams, stats } = useLoaderData<{ teams: Team[]; stats: Stats[] }>()

	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<Nav title="My Teams" />
			{teams.length > 0 ? (
				<ul className="space-y-3">
					{teams.map((t) => {
						return (
							<li key={t.id}>
								<Button asChild variant="link" className="pl-0">
									<a href={`/${t.slug}`} className="text-xl">
										{t.name}
									</a>
								</Button>
								<Suspense>
									<Await resolve={stats}>
										{(stats) => {
											const statsForTeam = stats.find((s) => s.id === t.id)
											invariant(statsForTeam, 'No statsForTeam')
											return (
												<p>
													{statsForTeam.playerCount} player
													{statsForTeam.playerCount !== 1 && 's'},{' '}
													{statsForTeam.statCount} stat
													{statsForTeam.statCount !== 1 && 's'} recorded
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

			<Dialog>
				<DialogTrigger asChild>
					<Button className="w-full sm:w-auto">Create team</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New team</DialogTitle>
					</DialogHeader>
					<NewTeamForm />
				</DialogContent>
			</Dialog>
		</div>
	)
}
