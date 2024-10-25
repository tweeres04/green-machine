import type {
	LoaderFunctionArgs,
	MetaArgs,
	MetaFunction,
} from '@remix-run/node'
import {
	Link,
	useFetcher,
	useLoaderData,
	useNavigation,
	useSearchParams,
} from '@remix-run/react'
import { Button } from '~/components/ui/button'

import { getDb } from '~/lib/getDb'
import { useEffect, useRef } from 'react'
import { Add } from '~/components/ui/icons/add'
import { Remove } from '~/components/ui/icons/remove'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { useToast } from '~/components/ui/use-toast'
import { Copy } from '~/components/ui/icons/copy'
import { Eye } from '~/components/ui/icons/eye'
import { Pencil } from '~/components/ui/icons/pencil'
import invariant from 'tiny-invariant'
import { StatEntry, type Team } from '~/schema'
import { cn } from '~/lib/utils'

export const meta: MetaFunction = ({ data }: MetaArgs) => {
	const {
		team: { name, slug },
	} = data as { team: Team }

	const title = `${name} - TeamStats`
	const description = `Team stats for ${name}. Add goals and assists for each player. Copy the standings to share with your team.`
	const url = `https://teamstats.tweeres.com/${slug}`

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

type PlayerWithStats = Awaited<ReturnType<typeof loader>>['team']['players'][0]

function CopyStandingsButton({
	players,
}: {
	players: Awaited<ReturnType<typeof loader>>['team']['players']
}) {
	const { toast } = useToast()
	return (
		<Button
			title="Copy standings"
			variant="secondary"
			onClick={async () => {
				await window.navigator.clipboard.writeText(`Stats:

${players
	.toSorted((a: PlayerWithStats, b: PlayerWithStats) => {
		const aGoals = a.statEntries.filter((se) => se.type === 'goal').length
		const bGoals = b.statEntries.filter((se) => se.type === 'goal').length
		return bGoals - aGoals
	})
	.map((p: PlayerWithStats) => {
		const goals = p.statEntries.filter((s) => s.type === 'goal').length
		const assists = p.statEntries.filter((s) => s.type === 'assist').length
		return `${p.name}: ${goals}G ${assists}A`
	})
	.join('\n')}`)

				toast({
					description: 'Standings copied to clipboard',
				})
			}}
		>
			<Copy />
		</Button>
	)
}

export async function loader({
	params: { teamSlug },
	request,
}: LoaderFunctionArgs) {
	const db = getDb()

	invariant(teamSlug, 'Missing teamSlug parameter')

	const searchParams = new URL(request.url).searchParams
	const editMode = searchParams.has('edit')

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

	if (!editMode) {
		// todo: move this sorting to the db at some point
		team.players = team.players.toSorted((a, b) => {
			const aGoals = a.statEntries.filter((se) => se.type === 'goal').length
			const bGoals = b.statEntries.filter((se) => se.type === 'goal').length

			const goalDifference = bGoals - aGoals

			if (goalDifference !== 0) {
				return goalDifference
			}
			const aAssists = a.statEntries.filter((se) => se.type === 'assist').length
			const bAssists = b.statEntries.filter((se) => se.type === 'assist').length

			return bAssists - aAssists
		})
	}
	return { team }
}

function useClearNewPlayerForm(
	formRef: React.MutableRefObject<HTMLFormElement | null>
) {
	const navigation = useNavigation()
	const isAddingPlayer =
		navigation.state === 'submitting' &&
		/teams\/.+\/players/.test(navigation.formAction) &&
		navigation.formMethod === 'POST'

	useEffect(() => {
		if (!isAddingPlayer) {
			formRef.current?.reset()
		}
	}, [formRef, isAddingPlayer])
}

type Game = { time: string; field: string; opponent: string }

function NextGame({ games }: { games: Game[] }) {
	const now = new Date()
	const nextGame = games.filter((game) => new Date(game.time) > now)[0]
	const { toast } = useToast()
	const formattedTime = nextGame
		? new Intl.DateTimeFormat('en-CA', {
				weekday: 'long',
				hour: 'numeric',
				minute: 'numeric',
		  }).format(new Date(nextGame?.time))
		: null

	return nextGame ? (
		<div className="next-game">
			<div className="flex mb-2">
				<h2 className="text-2xl grow">Next game</h2>
				<Button
					title="Copy next game"
					variant="secondary"
					onClick={async () => {
						await window.navigator.clipboard.writeText(`Next game:

${formattedTime}
${nextGame.field}
vs ${nextGame.opponent}`)
						toast({
							description: 'Next game copied to clipboard',
						})
					}}
				>
					<Copy />
				</Button>
			</div>
			<div className="font-bold">{formattedTime}</div>
			<div className="text-[14px]">{nextGame.field}</div>
			<div className="text-[14px]">vs {nextGame.opponent}</div>
		</div>
	) : null
}

type OptimisticState =
	| 'submittingGoal'
	| 'removingGoal'
	| 'submittingAssist'
	| 'removingAssist'
	| null

export default function Team() {
	const { team } = useLoaderData<typeof loader>()
	const { name, slug, players } = team
	const formRef = useRef<HTMLFormElement>(null)
	const navigation = useNavigation()
	const [searchParams] = useSearchParams()
	const fetcher = useFetcher()

	const editMode = searchParams.has('edit')

	const isUpdating =
		navigation.state === 'submitting' &&
		/\/players\/\d+?\/(goals|assists|destroy)/.test(navigation.formAction) &&
		navigation.formMethod === 'POST'

	useClearNewPlayerForm(formRef)

	function days() {
		return Array.from(
			new Set(
				players.flatMap((p) =>
					p.statEntries.flatMap(
						(se) => new Date(se.timestamp).toISOString().split('T')[0]
					)
				)
			)
		).toSorted() as string[]
	}

	return (
		<>
			<div className="flex items-center gap-2">
				<Avatar>
					<AvatarFallback>{name[0]}</AvatarFallback>
				</Avatar>
				<h1 className="grow text-3xl">{name}</h1>
				<Button asChild variant="link">
					<Link to={`/${slug}/edit`}>Team settings</Link>
				</Button>
			</div>
			<div className="flex gap-1 mb-3 items-center">
				<h2 className="grow text-2xl">Stats</h2>
				<Link to={editMode ? `/${slug}` : `/${slug}?edit`}>
					<Button variant="secondary">{editMode ? <Eye /> : <Pencil />}</Button>
				</Link>
				<CopyStandingsButton players={players} />
			</div>
			<div className="overflow-x-auto w-full">
				<table className="w-full">
					{editMode ? null : (
						<thead>
							<tr>
								<th></th> {/* Avatar */}
								<th className="hidden md:table-cell"></th> {/* Name */}
								{days().map((day) => (
									<th key={day} className="text-xs -rotate-90 h-10">
										{new Date(day)
											.toLocaleDateString()
											.match(/\d{1,2}\/\d{1,2}/)}
									</th>
								))}
								<th></th> {/* Totals */}
							</tr>
						</thead>
					)}

					{players.map((p) => {
						const optimisticState: OptimisticState =
							fetcher.state === 'submitting' || fetcher.state === 'loading'
								? fetcher.formAction === `/players/${p.id}/goals`
									? 'submittingGoal'
									: fetcher.formAction ===
									  `/players/${p.id}/goals/destroy_latest`
									? 'removingGoal'
									: fetcher.formAction === `/players/${p.id}/assists`
									? 'submittingAssist'
									: fetcher.formAction ===
									  `/players/${p.id}/assists/destroy_latest`
									? 'removingAssist'
									: null
								: null
						const goalCount =
							p.statEntries.filter((s) => s.type === 'goal').length +
							(optimisticState === 'submittingGoal' ? 1 : 0) +
							(optimisticState === 'removingGoal' ? -1 : 0)
						const assistCount =
							p.statEntries.filter((s) => s.type === 'assist').length +
							(optimisticState === 'submittingAssist' ? 1 : 0) +
							(optimisticState === 'removingAssist' ? -1 : 0)
						const statEntriesByDay: [string, StatEntry[]][] =
							p.statEntries.reduce(
								(acc: [string, StatEntry[]][], se) => {
									const date = new Date(se.timestamp)
										.toISOString()
										.split('T')[0]
									const dateEntryPair = acc.find(([d]) => d === date)
									dateEntryPair[1]?.push(se)

									return acc
								},
								days().map((d) => [d, []])
							)

						return (
							<tr key={p.id}>
								<td className="sticky left-0">
									<Avatar title={p.name}>
										<AvatarFallback>{p.name[0]}</AvatarFallback>
									</Avatar>
								</td>
								{editMode ? null : (
									<td className="hidden md:table-cell">{p.name}</td>
								)}
								{editMode
									? null
									: statEntriesByDay.map(([date, entries], i) => (
											<td
												key={date}
												className={cn(
													'text-center text-nowrap',
													i !== statEntriesByDay.length - 1
														? 'border-r border-green-900/25 border-dashed'
														: null
												)}
											>
												{entries.map(({ type, timestamp }, i) => (
													<span
														key={i}
														className={cn(
															'inline-block text-xs',
															i !== 0 ? '-ml-2' : null
														)}
														title={new Date(timestamp).toLocaleDateString()}
													>
														{type === 'goal' ? '⚽️' : '🍎'}
													</span>
												))}
											</td>
									  ))}
								<td className="text-2xl text-right text-nowrap sticky right-0">
									{p.statEntries.length === 0
										? '-'
										: `${goalCount}G ${assistCount}A`}
								</td>
								{editMode ? (
									<td className="flex gap-1">
										<fetcher.Form
											method="post"
											action={`/players/${p.id}/assists/destroy_latest`}
										>
											<Button
												variant="secondary"
												size="sm"
												disabled={isUpdating}
												aria-label="Remove assist"
												className="relative"
											>
												🍎
												<Remove />
											</Button>
										</fetcher.Form>
										<fetcher.Form
											method="post"
											action={`/players/${p.id}/assists`}
										>
											<Button
												variant="secondary"
												size="sm"
												disabled={isUpdating}
												aria-label="Add assist"
												className="relative"
											>
												🍎
												<Add />
											</Button>
										</fetcher.Form>
										<fetcher.Form
											method="post"
											action={`/players/${p.id}/goals/destroy_latest`}
										>
											<Button
												variant="secondary"
												size="sm"
												disabled={isUpdating}
												aria-label="Remove goal"
												className="relative"
											>
												⚽️
												<Remove />
											</Button>
										</fetcher.Form>
										<fetcher.Form
											method="post"
											action={`/players/${p.id}/goals`}
										>
											<Button
												variant="secondary"
												size="sm"
												disabled={isUpdating}
												aria-label="Add goal"
												className="relative"
											>
												⚽️
												<Add />
											</Button>
										</fetcher.Form>
									</td>
								) : null}
							</tr>
						)
					})}
				</table>
			</div>
		</>
	)
}
