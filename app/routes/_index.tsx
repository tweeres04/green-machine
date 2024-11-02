import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { Form, json, useLoaderData } from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { kebabCase } from 'lodash-es'
import React from 'react'
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
		select
			teams.id,
			teams.name,
			teams.slug,
			count(players.id) playerCount,
			count(stat_entries.id) statCount
		from teams
			inner join users_teams on teams.id = users_teams.team_id
			inner join players players_for_users on teams.id = players.team_id
			inner join user_invites on user_invites.player_id = players_for_users.id
			left join players on teams.id = players.team_id
			left join stat_entries on players.id = stat_entries.player_id
		where
			users_teams.user_id = ${user.id} or user_invites.user_id = ${user.id}
		group by teams.id
	`

	const teams_ = await db.all(sql_)

	return json({ teams: teams_ })
}

type Team = {
	id: number
	name: string
	slug: string
	playerCount: number
	statCount: number
}

export default function Index() {
	const { teams } = useLoaderData<{ teams: Team[] }>()

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
								<p>
									{t.playerCount} player{t.playerCount !== 1 && 's'},{' '}
									{t.statCount} stat{t.statCount !== 1 && 's'} recorded
								</p>
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
