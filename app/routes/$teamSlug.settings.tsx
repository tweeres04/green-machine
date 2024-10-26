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

export const meta: MetaFunction = ({ data }: MetaArgs) => {
	const {
		team: { name, slug },
	} = data as { team: Team }

	const title = `Edit ${name} - TeamStats`
	const description = `Edit ${name}.`
	const url = `https://teamstats.tweeres.com/${slug}/edit`

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
	const { id, name, slug, players, color } = team
	const formRef = useRef<HTMLFormElement>(null)
	const fetcher = useFetcher()

	useClearNewPlayerForm(formRef)

	return (
		<>
			<Nav title="Team settings" team={team} />
			<div className="space-y-3">
				<h3 className="text-xl mb-3">Team Color</h3>
				<fetcher.Form
					method="post"
					action={`/teams/${id}/color`}
					className="space-y-3"
					onInput={(event) => {
						fetcher.submit(event.currentTarget)
					}}
				>
					<input type="hidden" name="slug" value={slug} />
					<select
						name="color"
						className="w-full p-2 border rounded bg-white"
						defaultValue={color}
					>
						<option value="gray">Gray</option>
						<option value="red">Red</option>
						<option value="orange">Orange</option>
						<option value="yellow">Yellow</option>
						<option value="green">Green</option>
						<option value="blue">Blue</option>
						<option value="purple">Purple</option>
						<option value="pink">Pink</option>
					</select>
				</fetcher.Form>
			</div>
			<h2 className="mb-3 text-2xl">Players</h2>
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
			<div className="space-y-3">
				<h3 className="text-xl mb-3">Add player</h3>
				<fetcher.Form
					method="post"
					action={`/teams/${id}/players`}
					className="space-y-3"
					ref={formRef}
				>
					<input type="hidden" name="slug" value={slug} />
					<Input name="name" />
					<Button>Add player</Button>
				</fetcher.Form>
			</div>
		</>
	)
}
