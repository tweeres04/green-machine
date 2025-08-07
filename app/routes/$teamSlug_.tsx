import type {
	LoaderFunctionArgs,
	MetaArgs,
	MetaFunction,
} from '@remix-run/node'
import { eq } from 'drizzle-orm'
import {
	useFetcher,
	useLoaderData,
	useLocation,
	useNavigate,
} from '@remix-run/react'
import { Button } from '~/components/ui/button'
import { GuestUserAlert } from '~/components/ui/guest-user-alert'

import { getDb } from '~/lib/getDb'
import { Add } from '~/components/ui/icons/add'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { useToast } from '~/components/ui/use-toast'
import { Toaster } from '~/components/ui/toaster'
import invariant from 'tiny-invariant'
import { Game, Season, StatEntry, teams, type Team } from '~/schema'
import { cn } from '~/lib/utils'
import { endOfDay, format, formatISO, isFuture, parseISO } from 'date-fns'
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
import {
	ArrowRightCircle,
	ArrowUpDown,
	Calendar,
	ChevronsUpDown,
	Share,
} from 'lucide-react'
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
import { getSession } from '~/lib/five-minute-session.server' // Add this import
import { GameCard } from './$teamSlug.games'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '~/components/ui/collapsible'

export const meta: MetaFunction = ({ data }: MetaArgs) => {
	const {
		team: { name, slug },
	} = data as { team: Team }

	const title = `${name} - TeamStats`
	const description = `Team stats for ${name}. Track goals and assists for each player. Shareable standings.`
	const url = `https://teamstats.tweeres.com/${slug}`

	return [
		{ title },
		{
			name: 'description',
			content: description,
		},
		{ name: 'robots', context: 'noindex' },
		{
			tagName: 'link',
			rel: 'canonical',
			href: url,
		},
		{ name: 'og:title', content: title },
		{ name: 'og:type', content: 'website' },
		{ name: 'og:description', content: description },
		{
			name: 'og:image',
			content: 'https://teamstats.tweeres.com/opengraph.png',
		},
		{ name: 'og:url', content: url },
		{ tagName: 'link', rel: 'canonical', href: url },
	]
}

type PlayerWithStats = Awaited<ReturnType<typeof loader>>['team']['players'][0]

function ShareStandingsButton({
	teamName,
	slug,
	players,
	season,
}: {
	teamName: string
	slug: string
	players: Awaited<ReturnType<typeof loader>>['team']['players']
	season?: Season | null
}) {
	const { toast } = useToast()
	const location = useLocation()

	const shareAvailable = typeof window !== 'undefined' && 'share' in navigator

	const title = `${teamName} Standings${season ? ` (${season.name})` : ''}`
	const url = `https://teamstats.tweeres.com/${slug}${location.search}`
	const playersWithStats = players.filter(
		(p: PlayerWithStats) => p.statEntries.length > 0
	)
	const standingsText =
		playersWithStats.length > 0
			? `${playersWithStats
					.map((p: PlayerWithStats) => {
						const goals = p.statEntries.filter((s) => s.type === 'goal').length
						const assists = p.statEntries.filter(
							(s) => s.type === 'assist'
						).length
						return `${p.name}: ${goals}G ${assists}A`
					})
					.join('\n')}`
			: 'No stats yet'

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

	const teamQuery = db
		.select({ id: teams.id })
		.from(teams)
		.where(eq(teams.slug, teamSlug))
	const season = seasonId
		? seasonId === 'all'
			? null
			: await db.query.seasons.findFirst({
					where: (seasons, { and, eq }) =>
						and(
							eq(seasons.teamId, teamQuery),
							eq(seasons.id, parseInt(seasonId))
						),
			  })
		: await db.query.seasons.findFirst({
				where: (seasons, { and, eq, gte, lte }) =>
					and(
						eq(seasons.teamId, teamQuery),
						lte(seasons.startDate, formatISO(new Date())),
						gte(seasons.endDate, formatISO(new Date()))
					),
		  })

	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
		with: {
			players: {
				with: {
					userInvites: true,
					rsvps: true,
					statEntries: season
						? {
								where: (statEntries, { and, gte, lte }) => {
									invariant(season, 'No season inside stats query')

									let endOfSeasonEndDay: Date | string = parseISO(
										season.endDate
									)
									endOfSeasonEndDay = endOfDay(endOfSeasonEndDay)
									endOfSeasonEndDay = formatISO(endOfSeasonEndDay)

									// TODO: need to check the game date first
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
				where: season
					? (games, { and, gte, lte }) => {
							invariant(season, 'No season inside stats query')

							let endOfSeasonEndDay: Date | string = parseISO(season.endDate)
							endOfSeasonEndDay = endOfDay(endOfSeasonEndDay)
							endOfSeasonEndDay = formatISO(endOfSeasonEndDay)

							// this _may_ fail across dst since sqlite does a string comparison (but I'll tackle that if it actually happens)
							return and(
								gte(games.timestamp, season.startDate),
								lte(games.timestamp, endOfSeasonEndDay)
							)
					  }
					: undefined,
				with: {
					rsvps: true,
					statEntries: {
						with: {
							player: true,
						},
					},
				},
			},
			subscription: true,
			seasons: {
				orderBy: (seasons, { desc }) => [desc(seasons.startDate)],
			},
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

	const player = user
		? team.players.find((player) =>
				player.userInvites.some((ui) => ui.userId === user.id && ui.acceptedAt)
		  )
		: null

	const teamHasActiveSubscription_ = teamHasActiveSubscription(team)

	const session = await getSession(request.headers.get('Cookie'))
	const guestUserAlertDismissed =
		session.get('guestUserAlertDismissed') === 'true'

	return {
		team,
		userHasAccessToTeam,
		teamHasActiveSubscription: teamHasActiveSubscription_,
		seasons: team.seasons,
		season,
		player,
		guestUserAlertDismissed,
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
	const fetcher = useFetcher<{ rowsAffected: number }>()

	const isSubmitting =
		fetcher.state === 'submitting' &&
		fetcher.formAction === `/stats/${data?.id}`

	const localTimestamp = data?.timestamp ? parseISO(data?.timestamp) : null
	const datepickerTimestampString = localTimestamp
		? formatISO(localTimestamp).slice(0, 19) // Chop off offset
		: undefined

	useEffect(() => {
		if (fetcher.state === 'loading' && fetcher.data?.rowsAffected === 1) {
			closeDialog()
		}
	}, [closeDialog, fetcher.data?.rowsAffected, fetcher.state])

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
	const fetcher = useFetcher<{ rowsAffected: number }>()

	const isSubmitting =
		fetcher.state === 'submitting' &&
		fetcher.formAction === `/stats/${data?.id}`

	useEffect(() => {
		if (fetcher.state === 'loading' && fetcher.data?.rowsAffected === 1) {
			closeDialog()
		}
	}, [closeDialog, fetcher.data?.rowsAffected, fetcher.state])

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
				<td
					className={`sticky left-0 bg-${teamColor}-50 z-10 flex items-center`}
				>
					<Popover>
						<PopoverTrigger>
							<Avatar title={player.name} className="shadow">
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
								: null,
							`has-[.stat]:bg-${teamColor}-100`
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
												'stat inline-block relative text-xs',
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
					className={`text-xl text-right text-nowrap sticky right-0 bg-${teamColor}-50`}
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
	const fetcher = useFetcher<{ rowsAffected: number }>()
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
			fetcher.data?.rowsAffected > 0
		) {
			setDialogOpen(false)
		}
	}, [fetcher.data, fetcher.data?.rowsAffected, fetcher.state])

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
						) : (
							<SelectItem disabled value="no-past-games">
								No past games
							</SelectItem>
						)}
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
					disabled={isSubmitting}
					className="grow overflow-y-auto h-[9000px]" // flexbox auto calculates, but I need it higher than what flexbox will calculate
				>
					<ul className="py-1 space-y-1">
						{players
							.toSorted((a, b) => a.name.localeCompare(b.name))
							.map((player) => (
								<li
									key={player.id}
									className="grid grid-cols-3 gap-3 items-center"
								>
									<div>{player.name}</div>
									<div>
										{(() => {
											const existingStats = players.flatMap((p) =>
												p.statEntries.filter(
													(se) => se.gameId === Number(selectedGameId)
												)
											)
											const goals = existingStats.filter(
												(s) => s.playerId === player.id && s.type === 'goal'
											).length
											const assists = existingStats.filter(
												(s) => s.playerId === player.id && s.type === 'assist'
											).length
											return (
												<div className="text-[0.6rem]">
													{goals ? <span>{goals}⚽️</span> : null}{' '}
													{assists ? <span>{assists}🍎</span> : null}
												</div>
											)
										})()}
										{(() => {
											const goals = stats.filter(
												(s) => s.playerId === player.id && s.type === 'goal'
											).length
											const assists = stats.filter(
												(s) => s.playerId === player.id && s.type === 'assist'
											).length
											return (
												<div>
													{goals || assists ? '+' : null}
													{goals ? <span>{goals}⚽️</span> : null}{' '}
													{assists ? <span>{assists}🍎</span> : null}
												</div>
											)
										})()}
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
						<Button
							type="submit"
							onClick={submit}
							disabled={!selectedGameId || stats.length === 0}
						>
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
	season: Season | null | undefined
}) {
	const path = useLocation().pathname
	const navigate = useNavigate()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="secondary" className="flex items-center gap-1">
					<Calendar />
					<span>{season?.name ?? 'All seasons'}</span>
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
					<DropdownMenuRadioItem value="all">All seasons</DropdownMenuRadioItem>
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
				<Button variant="secondary" className="flex items-center gap-1">
					<ArrowUpDown />
					<span>{sortLabel}</span>
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
					<DropdownMenuRadioItem value="goals">Goals</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="assists">Assists</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default function Home() {
	const {
		team,
		userHasAccessToTeam,
		teamHasActiveSubscription,
		season,
		seasons,
		player,
		guestUserAlertDismissed,
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

	const nextGame = team.games.filter(
		(g) => g.timestamp && isFuture(g.timestamp)
	)[0]

	return (
		<>
			<Nav title={team.name} team={team} />
			{nextGame ? (
				<Collapsible className="space-y-3" defaultOpen>
					<CollapsibleTrigger className="flex w-full place-items-center">
						<h2 className="text-2xl flex-grow text-left">Next game</h2>
						<Button size="icon" variant="ghost">
							<ChevronsUpDown />
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<GameCard
							game={nextGame}
							team={team}
							userHasAccessToTeam={userHasAccessToTeam}
							player={player}
							teamHasActiveSubscription={Boolean(teamHasActiveSubscription)}
							nextGame
						/>
					</CollapsibleContent>
				</Collapsible>
			) : null}
			<div className="space-y-5">
				<h2 className="text-2xl">Stats</h2>
				<div className="flex gap-1 flex-row-reverse">
					<div className="hidden sm:block">
						<ShareStandingsButton
							slug={team.slug}
							teamName={team.name}
							players={players}
							season={season}
						/>{' '}
						{userHasAccessToTeam ? (
							<AddStatsButton
								players={players}
								disabled={!teamHasActiveSubscription}
								games={team.games}
							/>
						) : null}
					</div>
					<SortDropdown />
					{seasons.length > 0 && (
						<SeasonDropdown seasons={seasons} season={season} />
					)}
				</div>
				<div className="overflow-x-auto w-full" id="table_container">
					<table className="w-full [&_td]:px-2 [&_td]:py-2 [&_th]:pb-2">
						<thead>
							<tr>
								<th className={`sticky left-0 bg-${team.color}-50 z-10`}></th>
								{/* Avatar */}
								<th className="hidden md:table-cell"></th> {/* Name */}
								{days().map((day) => (
									<th key={day} className="text-xs rotate-45 h-10">
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
			</div>
			<div
				className={`sm:hidden fixed bottom-4 right-0 border-${team.color}-200 p-4 pl-6 bg-${team.color}-50 border border-${team.color}-200 rounded-lg z-10 shadow transition-transform duration-100 ease-out rounded-r-none`}
			>
				<button
					className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-2 border-${team.color}-200 rounded-full p-1 shadown bg-${team.color}-50`}
					onClick={(event) => {
						const parentElement = event.currentTarget.parentElement
						const rightArrow = parentElement?.querySelector(
							'[data-toggle-id=right_circle]'
						)
						const translateClassname = 'translate-x-[calc(100%-19px)]' // offsetwidth was returning undefined, so I'm hardcoding this for now
						const rotateClassname = 'rotate-180'

						if (parentElement?.classList.contains(translateClassname)) {
							parentElement.classList.remove(translateClassname)
							rightArrow?.classList.remove(rotateClassname)
						} else {
							parentElement?.classList.add(translateClassname)
							rightArrow?.classList.add(rotateClassname)
						}
					}}
				>
					<ArrowRightCircle
						className={`text-${team.color}-900 transition-transform duration-500 ease-out`}
						data-toggle-id="right_circle"
					/>
				</button>
				<ShareStandingsButton
					slug={team.slug}
					teamName={team.name}
					players={players}
					season={season}
				/>{' '}
				{userHasAccessToTeam ? (
					<AddStatsButton
						players={players}
						disabled={!teamHasActiveSubscription}
						games={team.games}
					/>
				) : null}
			</div>
			<GuestUserAlert
				userHasAccessToTeam={userHasAccessToTeam}
				player={Boolean(player)}
				dismissed={guestUserAlertDismissed}
				teamId={team.id}
			/>
			<Toaster />
		</>
	)
}
