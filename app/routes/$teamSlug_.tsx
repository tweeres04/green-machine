import type {
	LoaderFunctionArgs,
	MetaArgs,
	MetaFunction,
} from '@remix-run/node'
import {
	useFetcher,
	useLoaderData,
	useLocation,
	useNavigate,
} from '@remix-run/react'
import { Button } from '~/components/ui/button'

import { getDb } from '~/lib/getDb'
import { Add } from '~/components/ui/icons/add'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { useToast } from '~/components/ui/use-toast'
import { Toaster } from '~/components/ui/toaster'
import invariant from 'tiny-invariant'
import { Game, Season, StatEntry, type Team } from '~/schema'
import { cn } from '~/lib/utils'
import { endOfDay, format, formatISO, parseISO } from 'date-fns'
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
} from '~/components/ui/dialog'
import { capitalize } from 'lodash-es'
import { Input } from '~/components/ui/input'
import Nav from '~/components/ui/nav'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { useEffect, useState } from 'react'
import Trash from '~/components/ui/icons/trash'
import { DialogDescription } from '@radix-ui/react-dialog'
import { teamHasActiveSubscription } from '~/lib/teamHasActiveSubscription'
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from '~/components/ui/dropdown-menu'
import { ChevronDown, Share } from 'lucide-react'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select'

export const meta: MetaFunction = ({ data }: MetaArgs) => {
	const {
		team: { name, slug },
	} = data as { team: Team }

	const title = `${name} - TeamStats`
	const description = `Team stats for ${name}. Add goals and assists for each player. Shareable standings.`
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
	teamName,
	slug,
	players,
}: {
	teamName: string
	slug: string
	players: Awaited<ReturnType<typeof loader>>['team']['players']
}) {
	const { toast } = useToast()
	const location = useLocation()

	const shareAvailable = typeof window !== 'undefined' && 'share' in navigator

	const title = `${teamName} Standings`
	const url = `https://teamstats.tweeres.com/${slug}${location.search}`
	const standingsText = `${players
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
		.join('\n')}`

	return (
		<Button
			title="Copy standings"
			variant="secondary"
			size="icon"
			onClick={async () => {
				if (shareAvailable) {
					await navigator.share({
						title,
						text: standingsText,
						url,
					})
				} else {
					await window.navigator.clipboard.writeText(`${title}:

${standingsText}

${url}`)
					toast({
						description: 'Standings copied to clipboard',
					})
				}
			}}
		>
			{<Share />}
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

	const searchParams = new URL(request.url).searchParams
	const seasonId = searchParams.get('season')
	const sort = searchParams.get('sort') ?? 'goals'

	const season = seasonId
		? await db.query.seasons.findFirst({
				where: (seasons, { eq }) => eq(seasons.id, parseInt(seasonId)),
		  })
		: null

	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
		with: {
			players: {
				with: {
					statEntries: seasonId
						? {
								where: (statEntries, { and, gte, lte }) => {
									invariant(season, 'No season inside stats query')

									let endOfSeasonEndDay: Date | string = parseISO(
										season.endDate
									)
									endOfSeasonEndDay = endOfDay(endOfSeasonEndDay)
									endOfSeasonEndDay = formatISO(endOfSeasonEndDay)

									// this _may_ fail across dst since sqlite does a string comparison (but I'll tackle that if it actually happens)
									return and(
										gte(statEntries.timestamp, season.startDate),
										lte(statEntries.timestamp, endOfSeasonEndDay)
									)
								},
								with: {
									game: true,
								},
						  }
						: { with: { game: true } },
				},
				orderBy: (players, { asc }) => [asc(players.name)],
			},
			games: {
				orderBy: (games, { asc }) => [asc(games.timestamp)],
			},
			subscription: true,
			seasons: true,
		},
	})

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)

	// todo: move this sorting to the db at some point
	team.players = team.players.toSorted((a, b) => {
		if (sort === 'name') {
			return a.name.localeCompare(b.name)
		}

		const aGoals = a.statEntries.filter((se) => se.type === 'goal').length
		const bGoals = b.statEntries.filter((se) => se.type === 'goal').length
		const aAssists = a.statEntries.filter((se) => se.type === 'assist').length
		const bAssists = b.statEntries.filter((se) => se.type === 'assist').length

		if (sort === 'goals') {
			if (bGoals !== aGoals) return bGoals - aGoals
			if (bAssists !== aAssists) return bAssists - aAssists
			return a.name.localeCompare(b.name)
		}
		if (sort === 'assists') {
			if (bAssists !== aAssists) return bAssists - aAssists
			if (bGoals !== aGoals) return bGoals - aGoals
			return a.name.localeCompare(b.name)
		}
		return 0
	})

	const teamHasActiveSubscription_ = teamHasActiveSubscription(team)

	return {
		team,
		userHasAccessToTeam,
		teamHasActiveSubscription: teamHasActiveSubscription_,
		seasons: team.seasons,
		season,
	}
}

const dateFormat = 'MMM d'
function formatLocalIsoDateString(dateIsoString: string) {
	const date = parseISO(dateIsoString)
	const result = format(date, dateFormat)

	return result
}

type StatEditDialogData = Omit<StatEntry, 'playerId' | 'gameId'> | null

function StatEditDialog({
	show,
	closeDialog,
	data,
}: {
	show: boolean
	closeDialog: () => void
	data: StatEditDialogData
}) {
	const fetcher = useFetcher()

	const isSubmitting =
		fetcher.state === 'submitting' &&
		fetcher.formAction === `/stats/${data?.id}`

	const localTimestamp = data?.timestamp ? parseISO(data?.timestamp) : null
	const datepickerTimestampString = localTimestamp
		? formatISO(localTimestamp).slice(0, 19) // Chop off offset
		: undefined

	useEffect(() => {
		if (fetcher.state === 'loading' && fetcher.data?.changes === 1) {
			closeDialog()
		}
	}, [closeDialog, fetcher.data?.changes, fetcher.state])

	return (
		<Dialog
			open={Boolean(show)}
			onOpenChange={(value) => {
				if (!value) {
					closeDialog()
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit {data?.type}</DialogTitle>
				</DialogHeader>
				<fetcher.Form action={`/stats/${data?.id}`} method="PATCH">
					<div className="pb-4">
						<Input
							type="datetime-local"
							defaultValue={datepickerTimestampString}
							step="1"
							onChange={(e) => {
								const timestampInput =
									e.target.parentElement?.querySelector<HTMLInputElement>(
										'#timestamp_input' // I should use a ref at some point
									)
								invariant(timestampInput, 'timestampInput not found')
								timestampInput.value = formatISO(parseISO(e.target.value))
							}}
						/>
						<input
							type="hidden"
							name="timestamp"
							id="timestamp_input"
							defaultValue={
								datepickerTimestampString
									? formatISO(parseISO(datepickerTimestampString))
									: undefined
							}
						/>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="secondary" type="button">
								Cancel
							</Button>
						</DialogClose>
						<Button type="submit" disabled={isSubmitting}>
							Save
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	)
}

type StatDeleteDialogData =
	| (Omit<StatEntry, 'playerId' | 'gameId'> & { playerName: string })
	| null

function StatDeleteDialog({
	show,
	closeDialog,
	data,
}: {
	show: boolean
	closeDialog: () => void
	data: StatDeleteDialogData
}) {
	const fetcher = useFetcher()

	const isSubmitting =
		fetcher.state === 'submitting' &&
		fetcher.formAction === `/stats/${data?.id}`

	useEffect(() => {
		if (fetcher.state === 'loading' && fetcher.data?.changes === 1) {
			closeDialog()
		}
	}, [closeDialog, fetcher.data?.changes, fetcher.state])

	return (
		<Dialog
			open={show}
			onOpenChange={(value) => {
				if (!value) {
					closeDialog()
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete {data?.type}?</DialogTitle>
					<DialogDescription>
						By {data?.playerName} on{' '}
						{data?.timestamp ? format(data.timestamp, dateFormat) : null}
					</DialogDescription>
				</DialogHeader>
				<fetcher.Form action={`/stats/${data?.id}`} method="DELETE">
					<fieldset disabled={isSubmitting}>
						<DialogFooter>
							<DialogClose asChild>
								<Button variant="secondary" type="button">
									Cancel
								</Button>
							</DialogClose>
							<Button type="submit" variant="destructive">
								Delete
							</Button>
						</DialogFooter>
					</fieldset>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	)
}

type OptimisticState =
	| 'submittingGoal'
	| 'removingGoal'
	| 'submittingAssist'
	| 'removingAssist'
	| null

function PlayerRow({
	teamColor,
	userHasAccessToTeam,
	player,
	days,
}: {
	teamColor: string
	userHasAccessToTeam: boolean
	player: PlayerWithStats
	days: () => string[]
}) {
	const [statEditDialog, setStatEditDialog] = useState<StatEditDialogData>(null)
	const [statDeleteDialog, setStatDeleteDialog] =
		useState<StatDeleteDialogData>(null)

	const goalCount = player.statEntries.filter((s) => s.type === 'goal').length
	const assistCount = player.statEntries.filter(
		(s) => s.type === 'assist'
	).length
	const statEntriesByDay: [string, StatEntry[]][] = player.statEntries.reduce(
		(acc: [string, StatEntry[]][], se) => {
			const date = parseISO(se.game?.timestamp ?? se.timestamp)
			const dateString = formatISO(date, {
				representation: 'date',
			})
			const dateEntryPair = acc.find(([d]) => d === dateString)
			invariant(dateEntryPair, 'dateEntryPair not found')
			dateEntryPair[1]?.push(se)

			return acc
		},
		days().map((d) => [d, []])
	)

	return (
		<>
			<tr key={player.id}>
				<td className={`sticky left-0 bg-${teamColor}-50 z-10`}>
					<Popover>
						<PopoverTrigger>
							<Avatar title={player.name}>
								<AvatarImage
									src={`https://files.tweeres.com/teamstats/players/${player.id}/image`}
									className="object-cover"
								/>
								<AvatarFallback>{player.name[0]}</AvatarFallback>
							</Avatar>
						</PopoverTrigger>
						<PopoverContent>{player.name}</PopoverContent>
					</Popover>
				</td>
				<td className="hidden md:table-cell">{player.name}</td>
				{statEntriesByDay.map(([date, entries], entryDateIndex) => (
					<td
						key={date}
						className={cn(
							'text-center text-nowrap',
							entryDateIndex !== statEntriesByDay.length - 1
								? 'border-r border-green-900/25 border-dashed'
								: null
						)}
					>
						{entries.map(({ id, type, timestamp }, i) => {
							const localTimestamp = parseISO(timestamp)

							const isStreak =
								(entryDateIndex !== 0 &&
									statEntriesByDay[entryDateIndex - 1][1].some(
										(se) => se.type === type
									)) ||
								(entryDateIndex !== statEntriesByDay.length - 1 &&
									statEntriesByDay[entryDateIndex + 1][1].some(
										(se) => se.type === type
									))

							return (
								<Popover key={id}>
									<PopoverTrigger>
										<span
											className={cn(
												'inline-block relative text-xs',
												isStreak
													? "before:content-['🔥'] before:absolute before:-z-10 before:text-3xl before:opacity-20 before:left-1/2 before:-translate-x-1/2 before:top-1/2 before:-translate-y-[60%]"
													: null,
												i !== 0 ? '-ml-2' : null
											)}
										>
											{type === 'goal' ? '⚽️' : '🍎'}
										</span>
									</PopoverTrigger>
									<PopoverContent className="space-y-3">
										<div>
											{capitalize(type)} by {player.name} on{' '}
											{format(localTimestamp, dateFormat)}
										</div>
										{userHasAccessToTeam ? (
											<div className="flex gap-1 text-center">
												<Button
													variant="secondary"
													onClick={() => {
														setStatEditDialog({
															id,
															type,
															timestamp,
														})
													}}
												>
													Edit
												</Button>
												<Button
													className="shrink-0"
													variant="destructive"
													size="icon"
													onClick={() => {
														setStatDeleteDialog({
															id,
															type,
															playerName: player.name,
															timestamp,
														})
													}}
												>
													<Trash />
												</Button>
											</div>
										) : null}
									</PopoverContent>
								</Popover>
							)
						})}
					</td>
				))}
				<td
					className={`text-lg text-right text-nowrap sticky right-0 bg-${teamColor}-50`}
				>
					{player.statEntries.length === 0
						? '-'
						: `${goalCount}G ${assistCount}A`}
				</td>
			</tr>
			<StatEditDialog
				show={Boolean(statEditDialog)}
				closeDialog={() => setStatEditDialog(null)}
				data={statEditDialog}
			/>
			<StatDeleteDialog
				show={Boolean(statDeleteDialog)}
				closeDialog={() => setStatDeleteDialog(null)}
				data={statDeleteDialog}
			/>
		</>
	)
}

function AddStatsButton({
	players,
	disabled,
	games,
}: {
	players: PlayerWithStats[]
	disabled: boolean
	games: Game[]
}) {
	const datepickerTimestampString = () => formatISO(new Date()).slice(0, 16) // Chop off offset and seconds

	const [dialogOpen, setDialogOpen] = useState(false)
	const fetcher = useFetcher<{ changes: number }>()
	const [stats, setStats] = useState<Omit<StatEntry, 'id'>[]>([])
	const [selectedGameId, setSelectedGameId] = useState<string | null>(() =>
		games.length === 0 ? 'manual' : null
	)

	const [datepickerValue, setDatepickerValue] = useState(
		datepickerTimestampString
	)
	const [timestampValue, setTimestampValue] = useState(() =>
		formatISO(parseISO(datepickerTimestampString()))
	)

	const isSubmitting = fetcher.state === 'submitting'

	useEffect(() => {
		if (dialogOpen) {
			setStats([])
			const newDatepickerValue = datepickerTimestampString()
			setDatepickerValue(newDatepickerValue)
			const newTimestamp = formatISO(parseISO(newDatepickerValue))
			setTimestampValue(newTimestamp)
		}
	}, [dialogOpen])

	useEffect(() => {
		if (
			fetcher.state === 'loading' &&
			fetcher?.data &&
			fetcher.data?.changes > 0
		) {
			setDialogOpen(false)
		}
	}, [fetcher.data, fetcher.data?.changes, fetcher.state])

	function handleGameSelection(gameIdString: string) {
		setSelectedGameId(gameIdString)
		const newDatepickerValue = datepickerTimestampString()
		setDatepickerValue(newDatepickerValue)
		const newTimestamp = formatISO(parseISO(newDatepickerValue))
		setTimestampValue(newTimestamp)
		setStats((oldStats) =>
			oldStats.map((s) => ({
				...s,
				timestamp: newTimestamp,
				gameId: gameIdString === 'manual' ? null : Number(gameIdString),
			}))
		)
	}

	function submit(e: MouseEvent) {
		e.preventDefault()

		fetcher.submit(JSON.stringify(stats), {
			encType: 'application/json',
			action: '/stats',
			method: 'post',
		})
	}

	let pastGames = games
		.filter((g) => {
			const gameDate = g.timestamp ? parseISO(g.timestamp) : null
			const now = new Date()

			return gameDate && gameDate <= now
		})
		.reverse()

	const mostRecentGame = pastGames[0]

	pastGames = pastGames.slice(1)

	function GameOption({ game }: { game: Game }) {
		return (
			<SelectItem value={game.id.toString()}>
				{game.timestamp
					? format(parseISO(game.timestamp), 'EEE MMM d h:mm a')
					: 'TBD'}{' '}
				vs {game.opponent}
			</SelectItem>
		)
	}

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<Button
				size="icon"
				onClick={() => {
					setDialogOpen(true)
				}}
				disabled={disabled}
			>
				<Add />
			</Button>
			<DialogContent className="flex flex-col max-h-[95dvh] w-[92dvw]">
				<DialogHeader>
					<DialogTitle>Add stats</DialogTitle>
				</DialogHeader>

				<Select
					disabled={isSubmitting}
					value={selectedGameId ? selectedGameId : ''}
					onValueChange={handleGameSelection}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select game" />
					</SelectTrigger>
					<SelectContent>
						{mostRecentGame ? (
							<>
								<SelectGroup>
									<SelectLabel>Most recent game</SelectLabel>
									<GameOption game={mostRecentGame} />
								</SelectGroup>
								<SelectSeparator />
							</>
						) : null}
						{pastGames.length > 0 ? (
							<>
								<SelectGroup>
									<SelectLabel>Past games</SelectLabel>
									{pastGames.map((g) => (
										<SelectItem key={g.id} value={g.id.toString()}>
											{g.timestamp
												? format(parseISO(g.timestamp), 'EEE MMM d h:mm a')
												: 'TBD'}{' '}
											vs {g.opponent}
										</SelectItem>
									))}
								</SelectGroup>
								<SelectSeparator />
							</>
						) : null}
						<SelectItem value="manual">Enter a date and time</SelectItem>
					</SelectContent>
				</Select>

				{selectedGameId === 'manual' && (
					<Input
						type="datetime-local"
						value={datepickerValue}
						step="60"
						disabled={isSubmitting}
						onChange={(e) => {
							setDatepickerValue(e.target.value)
							const newTimestamp = formatISO(parseISO(e.target.value))
							setTimestampValue(newTimestamp)
							setStats((stats) =>
								stats.map((s) => ({
									...s,
									timestamp: newTimestamp,
								}))
							)
						}}
					/>
				)}

				<fieldset
					disabled={!selectedGameId || isSubmitting}
					className="grow overflow-y-auto h-[9000px]" // flexbox auto calculates, but I need it higher than what flexbox will calculate
				>
					<ul className="py-1 space-y-1">
						{players.map((player) => (
							<li
								key={player.id}
								className="grid grid-cols-3 gap-3 items-center"
							>
								<div>{player.name}</div>
								<div>
									{
										stats.filter(
											(s) => s.playerId === player.id && s.type === 'assist'
										).length
									}
									🍎{' '}
									{
										stats.filter(
											(s) => s.playerId === player.id && s.type === 'goal'
										).length
									}
									⚽️
								</div>
								<div className="flex gap-1 justify-end">
									<Button
										type="button"
										size="icon"
										variant="secondary"
										className="relative"
										onClick={() => {
											setStats((stats) => {
												return [
													...stats,
													{
														playerId: player.id,
														timestamp: timestampValue,
														type: 'assist',
														gameId:
															selectedGameId === 'manual'
																? null
																: Number(selectedGameId),
													},
												]
											})
										}}
									>
										🍎
										<Add className={cn('absolute top-0 right-0 size-4')} />
									</Button>
									<Button
										type="button"
										size="icon"
										variant="secondary"
										className="relative"
										onClick={() => {
											setStats((stats) => {
												return [
													...stats,
													{
														playerId: player.id,
														timestamp: timestampValue,
														type: 'goal',
														gameId:
															selectedGameId === 'manual'
																? null
																: Number(selectedGameId),
													},
												]
											})
										}}
									>
										⚽️
										<Add className={cn('absolute top-0 right-0 size-4')} />
									</Button>
								</div>
							</li>
						))}
					</ul>
				</fieldset>
				<fieldset disabled={isSubmitting}>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="secondary" type="button">
								Cancel
							</Button>
						</DialogClose>
						<Button type="submit" onClick={submit} disabled={!selectedGameId}>
							Save
						</Button>
					</DialogFooter>
				</fieldset>
			</DialogContent>
		</Dialog>
	)
}

function SeasonDropdown({
	seasons,
	season,
}: {
	seasons: { id: number; name: string }[]
	season: Season
}) {
	const path = useLocation().pathname
	const navigate = useNavigate()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="secondary">
					{season?.name ?? 'All seasons'}
					<ChevronDown />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup
					value={season?.id?.toString() ?? ''}
					onValueChange={(newSeasonId) => {
						if (newSeasonId) {
							navigate(`${path}?season=${newSeasonId}`)
						} else {
							navigate(path)
						}
					}}
				>
					<DropdownMenuRadioItem value="">All seasons</DropdownMenuRadioItem>
					{seasons.map((season) => (
						<DropdownMenuRadioItem value={season.id.toString()} key={season.id}>
							{season.name}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function SortDropdown() {
	const path = useLocation().pathname
	const navigate = useNavigate()
	const searchParams = new URLSearchParams(useLocation().search)
	const sort = searchParams.get('sort') ?? 'goals'

	const sortLabel = {
		name: 'Name',
		goals: 'Most goals',
		assists: 'Most assists',
	}[sort]

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="secondary">
					{sortLabel}
					<ChevronDown />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup
					value={sort}
					onValueChange={(newSort) => {
						searchParams.set('sort', newSort)
						navigate(`${path}?${searchParams.toString()}`)
					}}
				>
					<DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="goals">Goals</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="assists">Assists</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default function Stats() {
	const {
		team,
		userHasAccessToTeam,
		teamHasActiveSubscription,
		season,
		seasons,
	} = useLoaderData<typeof loader>()
	const { players } = team

	function days() {
		return Array.from(
			new Set(
				players.flatMap((p) =>
					p.statEntries.flatMap((se) => {
						const date = parseISO(se.game?.timestamp ?? se.timestamp)
						const isoString = formatISO(date, { representation: 'date' })

						return isoString
					})
				)
			)
		).toSorted() as string[]
	}

	useEffect(() => {
		const tableContainer = document.getElementById('table_container')
		invariant(tableContainer, 'tableContainer not found')
		tableContainer.scrollLeft = tableContainer.scrollWidth
	}, [])

	return (
		<>
			<Nav title="Stats" team={team} />
			<div className="flex gap-1 mb-3 items-center">
				<div className="grow flex flex-col sm:flex-row gap-1">
					{seasons.length > 0 && (
						<SeasonDropdown seasons={seasons} season={season} />
					)}
					<SortDropdown />
				</div>
				<CopyStandingsButton
					slug={team.slug}
					teamName={team.name}
					players={players}
				/>
				{userHasAccessToTeam ? (
					<AddStatsButton
						players={players}
						disabled={!teamHasActiveSubscription}
						games={team.games}
					/>
				) : null}
			</div>
			<div className="overflow-x-auto w-full" id="table_container">
				<table className="w-full [&_td]:px-1">
					<thead>
						<tr>
							<th className={`sticky left-0 bg-${team.color}-50 z-10`}></th>
							{/* Avatar */}
							<th className="hidden md:table-cell"></th> {/* Name */}
							{days().map((day) => (
								<th key={day} className="text-xs [writing-mode:vertical-lr]">
									{formatLocalIsoDateString(day)}
								</th>
							))}
							{/* Totals */}
							<th className={`sticky right-0 bg-${team.color}-50 z-10`}></th>
						</tr>
					</thead>
					<tbody>
						{players.map((p) => (
							<PlayerRow
								key={p.id}
								teamColor={team.color}
								userHasAccessToTeam={userHasAccessToTeam}
								player={p}
								days={days}
							/>
						))}
					</tbody>
				</table>
			</div>
			<Toaster />
		</>
	)
}
