import type {
	LoaderFunctionArgs,
	MetaArgs,
	MetaFunction,
} from '@remix-run/node'
import { useFetcher, useFetchers, useLoaderData } from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'

import { getDb } from '~/lib/getDb'
import { useEffect, useRef } from 'react'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import RemoveUser from '~/components/ui/icons/remove-user'
import invariant from 'tiny-invariant'
import { type Team } from '~/schema'
import Nav from '~/components/ui/nav'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog'

export const meta: MetaFunction = ({ data }: MetaArgs) => {
	const {
		team: { name, slug },
	} = data as { team: Team }

	const title = `Players - ${name} - TeamStats`
	const description = `Players - ${name}.`
	const url = `https://teamstats.tweeres.com/${slug}/players`

	return [
		{ title },
		{
			name: 'description',
			content: description,
		},
		{ name: 'robots', context: 'noindex' },
		{
			taname: 'link',
			rel: 'canonical',
			href: url,
		},
		{ name: 'og:title', content: title },
		{ name: 'og:type', content: 'website' },
		{ name: 'og:description', content: description },
		// { name: 'og:image', content: `` }, todo: add og:image
		{ name: 'og:url', content: url },
		{ tagName: 'link', rel: 'canonical', href: url },
	]
}

export async function loader({ params: { teamSlug } }: LoaderFunctionArgs) {
	const db = getDb()

	invariant(teamSlug, 'Missing teamSlug parameter')

	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
		with: {
			players: {
				with: {
					statEntries: true,
				},
				orderBy: (players, { asc }) => [asc(players.name)],
			},
		},
	})

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	return { team }
}

function useClearNewPlayerForm(
	formRef: React.MutableRefObject<HTMLFormElement | null>
) {
	const fetchers = useFetchers()
	const isAddingPlayer = fetchers.some(
		(fetcher) =>
			fetcher.state === 'submitting' &&
			/teams\/.+\/players/.test(fetcher.formAction) &&
			fetcher.formMethod === 'POST'
	)

	useEffect(() => {
		if (!isAddingPlayer) {
			formRef.current?.reset()
		}
	}, [formRef, isAddingPlayer])
}

export default function EditTeam() {
	const { team } = useLoaderData<typeof loader>()
	const { id, players } = team
	const formRef = useRef<HTMLFormElement>(null)
	const fetcher = useFetcher()

	useClearNewPlayerForm(formRef)

	return (
		<>
			<Nav title="Players" team={team} />
			<ul className="space-y-2">
				{players.map((p) => {
					const goalCount = p.statEntries.filter(
						(s) => s.type === 'goal'
					).length
					const assistCount = p.statEntries.filter(
						(s) => s.type === 'assist'
					).length
					return (
						<li className="flex items-center gap-3" key={p.id}>
							<Avatar>
								<AvatarFallback>{p.name[0]}</AvatarFallback>
							</Avatar>
							<span className="grow">{p.name}</span>
							<span className="text-2xl">
								{p.statEntries.length === 0
									? '-'
									: `${goalCount}G ${assistCount}A`}
							</span>
							<fetcher.Form method="post" action={`/players/${p.id}/destroy`}>
								<Button
									variant="destructive-outline"
									size="sm"
									aria-label="Remove player"
								>
									<RemoveUser />
								</Button>
							</fetcher.Form>
						</li>
					)
				})}
			</ul>
			<Dialog>
				<DialogTrigger asChild>
					<Button className="w-full sm:w-auto">Add player</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add player</DialogTitle>
					</DialogHeader>
					<fetcher.Form
						method="post"
						action={`/teams/${id}/players`}
						className="space-y-3"
						ref={formRef}
					>
						<div className="space-y-3">
							<div>
								<label htmlFor="name_input">Name</label>
								<Input name="name" id="name_input" />
							</div>
							<div>
								<label htmlFor="name_input">Email</label>
								<Input name="email" id="email_input" />
							</div>
						</div>
						<DialogFooter className="flex-col sm:flex-row">
							<Button variant="secondary">Cancel</Button>
							<Button type="submit">Save</Button>
						</DialogFooter>
					</fetcher.Form>
				</DialogContent>
			</Dialog>
		</>
	)
}
