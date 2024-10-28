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
import { format, formatISO, parseISO } from 'date-fns'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '~/components/ui/popover'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog'
import { capitalize } from 'lodash-es'
import { Input } from '~/components/ui/input'
import Nav from '~/components/ui/nav'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'

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
	invariant(teamSlug, 'Missing teamSlug parameter')

	const user = await authenticator.isAuthenticated(request)

	const db = getDb()

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

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)
	const searchParams = new URL(request.url).searchParams
	const editMode = userHasAccessToTeam && searchParams.has('edit')

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
	return { team, userHasAccessToTeam }
}

const dateFormat = 'MMM d'
function formatLocalIsoDateString(dateIsoString: string) {
	const date = parseISO(dateIsoString)
	const result = format(date, dateFormat)

	return result
}

type OptimisticState =
	| 'submittingGoal'
	| 'removingGoal'
	| 'submittingAssist'
	| 'removingAssist'
	| null

export default function Team() {
	const { team, userHasAccessToTeam } = useLoaderData<typeof loader>()
	const { slug, players } = team
	const navigation = useNavigation()
	const [searchParams] = useSearchParams()
	const fetcher = useFetcher()

	const editMode = userHasAccessToTeam && searchParams.has('edit')

	const isUpdating =
		navigation.state === 'submitting' &&
		/\/players\/\d+?\/(goals|assists|destroy)/.test(navigation.formAction) &&
		navigation.formMethod === 'POST'

	function days() {
		return Array.from(
			new Set(
				players.flatMap((p) =>
					p.statEntries.flatMap((se) => {
						const date = parseISO(se.timestamp)
						const isoString = formatISO(date, { representation: 'date' })

						return isoString
					})
				)
			)
		).toSorted() as string[]
	}

	return (
		<>
			<Nav team={team} />
			<div className="flex gap-1 mb-3 items-center">
				<h2 className="grow text-2xl">Stats</h2>
				{userHasAccessToTeam ? (
					<Link to={editMode ? `/${slug}` : `/${slug}?edit`}>
						<Button variant="secondary">
							{editMode ? <Eye /> : <Pencil />}
						</Button>
					</Link>
				) : null}
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
									<th key={day} className="text-xs [writing-mode:vertical-lr]">
										{formatLocalIsoDateString(day)}
									</th>
								))}
								<th></th> {/* Totals */}
							</tr>
						</thead>
					)}

					<tbody>
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
										const date = parseISO(se.timestamp)
										const dateString = formatISO(date, {
											representation: 'date',
										})
										const dateEntryPair = acc.find(([d]) => d === dateString)
										dateEntryPair[1]?.push(se)

										return acc
									},
									days().map((d) => [d, []])
								)

							return (
								<tr key={p.id}>
									<td className={`sticky left-0 bg-${team.color}-50`}>
										<Popover>
											<PopoverTrigger>
												<Avatar title={p.name}>
													<AvatarFallback>{p.name[0]}</AvatarFallback>
												</Avatar>
											</PopoverTrigger>
											<PopoverContent>{p.name}</PopoverContent>
										</Popover>
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
													{entries.map(({ id, type, timestamp }, i) => {
														const localTimestamp = parseISO(timestamp)
														const datepickerTimestampString = formatISO(
															localTimestamp
														).slice(0, 19) // Chop off offset

														const isSubmitting =
															fetcher.state === 'submitting' &&
															fetcher.formAction === `/stats/${id}`

														return (
															<Dialog key={`${type}${timestamp}`}>
																<Popover>
																	<PopoverTrigger>
																		<span
																			className={cn(
																				'inline-block text-xs',
																				i !== 0 ? '-ml-2' : null
																			)}
																		>
																			{type === 'goal' ? '⚽️' : '🍎'}
																		</span>
																	</PopoverTrigger>
																	<PopoverContent>
																		<div>
																			{capitalize(type)} by {p.name} on{' '}
																			{format(localTimestamp, dateFormat)}
																		</div>
																		{userHasAccessToTeam ? (
																			<div className="text-center">
																				<DialogTrigger asChild>
																					<Button variant="link" size="sm">
																						Edit
																					</Button>
																				</DialogTrigger>
																			</div>
																		) : null}
																	</PopoverContent>
																</Popover>
																<DialogContent>
																	<DialogHeader>
																		<DialogTitle>Edit {type}</DialogTitle>
																	</DialogHeader>
																	<fetcher.Form
																		action={`/stats/${id}`}
																		method="PATCH"
																	>
																		<div className="pb-4">
																			<Input
																				className="w-auto"
																				type="datetime-local"
																				defaultValue={datepickerTimestampString}
																				step="1"
																				onChange={(e) => {
																					const timestampInput =
																						e.target.parentElement?.querySelector<HTMLInputElement>(
																							'#timestamp_input' // I should use a ref at some point
																						)
																					invariant(
																						timestampInput,
																						'timestampInput not found'
																					)
																					timestampInput.value = new Date(
																						e.target.value
																					).toISOString()
																				}}
																			/>
																			<input
																				type="hidden"
																				name="timestamp"
																				id="timestamp_input"
																				defaultValue={new Date(
																					datepickerTimestampString
																				).toISOString()}
																			/>
																		</div>
																		<DialogFooter>
																			<DialogClose asChild>
																				<Button
																					variant="secondary"
																					type="button"
																				>
																					Cancel
																				</Button>
																			</DialogClose>
																			<Button
																				type="submit"
																				disabled={isSubmitting}
																			>
																				Save
																			</Button>
																		</DialogFooter>
																	</fetcher.Form>
																</DialogContent>
															</Dialog>
														)
													})}
												</td>
										  ))}
									<td
										className={`text-lg text-right text-nowrap sticky right-0 bg-${team.color}-50`}
									>
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
					</tbody>
				</table>
			</div>
		</>
	)
}
