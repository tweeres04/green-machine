import type {
	LoaderFunctionArgs,
	MetaArgs,
	MetaFunction,
} from '@remix-run/node'
import { eq } from 'drizzle-orm'
import {
	defer,
	Link,
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
import { Alert, AlertDescription } from '~/components/ui/alert'
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
import { upperFirst } from 'lodash-es'
import { Input } from '~/components/ui/input'
import Nav from '~/components/ui/nav'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { useEffect, useState, useRef } from 'react'
import Trash from '~/components/ui/icons/trash'
import { DialogDescription } from '@radix-ui/react-dialog'
import { teamHasActiveSubscription } from '~/lib/teamHasActiveSubscription'
import { getGamesWithStatsCount } from '~/lib/getGamesWithStatsCount'
import { Textarea } from '~/components/ui/textarea'
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from '~/components/ui/dropdown-menu'
import {
	ArrowRightCircle,
	ArrowUpDown,
	ChevronDown,
	ChevronsUpDown,
	LoaderCircle,
	MoreHorizontal,
	Share,
	Sparkles,
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
import { GameCard } from './$teamSlug.games'
import { StatsDialog } from '~/components/ui/stats-dialog'
import { SeasonDropdown } from '~/components/ui/season-dropdown'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '~/components/ui/collapsible'
import mixpanel from 'mixpanel-browser'
import { getGameForecast } from '~/lib/weather-service'
import {
	oncePerGameStatTypes,
	statEmoji,
	statLabel,
} from '~/lib/stat-types'
import { TrialStatus } from '~/components/ui/trial-status'

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
		{ name: 'robots', content: 'noindex' },
		{
			tagName: 'link',
			rel: 'canonical',
			href: url,
		},
		{ property: 'og:title', content: title },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:description', content: description },
		{
			property: 'og:image',
			content: `${url}/og.png`,
		},
		{ property: 'og:image:width', content: '1200' },
		{ property: 'og:image:height', content: '630' },
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ property: 'og:url', content: url },
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
			title="Share standings"
			variant="secondary"
			size="icon"
			onClick={async () => {
				if (shareAvailable) {
					navigator.share({
						title,
						text: standingsText,
						url,
					})
					mixpanel.track('share stats')
				} else {
					await window.navigator.clipboard.writeText(`${title}:

${standingsText}

${url}`)
					toast({
						description: 'Standings copied to clipboard',
					})
					mixpanel.track('copy stats to clipboard')
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
					statEntries: { with: { game: true } },
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

	// Game-linked stats belong to their game's season; stats without a game
	// (or with a TBD game) fall back to their own timestamp. Filtered here
	// instead of in the query because drizzle's relational `where` can't
	// reference the joined games table
	if (season) {
		const seasonStart = parseISO(season.startDate)
		const seasonEnd = endOfDay(parseISO(season.endDate))

		for (const player of team.players) {
			player.statEntries = player.statEntries.filter((se) => {
				const timestamp = parseISO(se.game?.timestamp ?? se.timestamp)
				return timestamp >= seasonStart && timestamp <= seasonEnd
			})
		}
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)

	const { columnKeyForGameTimestamp, columnKeyForStatEntry } = makeColumnKeys(
		team.games
	)
	const allColumnKeys = Array.from(
		new Set([
			...pastGameColumnKeys(team.games, columnKeyForGameTimestamp),
			...team.players.flatMap((p) => p.statEntries.map(columnKeyForStatEntry)),
		])
	).toSorted()
	const streakByPlayerId = new Map(
		team.players.map((p) => [
			p.id,
			bestStreak(p.statEntries, allColumnKeys, columnKeyForStatEntry).length,
		])
	)

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
		if (sort === 'contributions') {
			const aContributions = aGoals + aAssists
			const bContributions = bGoals + bAssists
			if (bContributions !== aContributions)
				return bContributions - aContributions
			if (bGoals !== aGoals) return bGoals - aGoals
			return a.name.localeCompare(b.name)
		}
		if (sort === 'streak') {
			const aStreak = streakByPlayerId.get(a.id) ?? 0
			const bStreak = streakByPlayerId.get(b.id) ?? 0
			if (bStreak !== aStreak) return bStreak - aStreak
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

	// Get games with stats count for free trial
	const gamesWithStatsCount = await getGamesWithStatsCount(team.id)

	// Get next game for weather forecast
	const now = new Date()
	const upcomingGames = team.games.filter(
		(game) => game.timestamp && new Date(game.timestamp) > now
	)
	const nextGame = upcomingGames[0]

	// Create weather data promise if forecast is enabled
	const weatherDataPromise =
		nextGame && team.nextGameForecast && team.location && nextGame.timestamp
			? getGameForecast(nextGame.id)
			: Promise.resolve(null)

	return defer({
		team,
		userHasAccessToTeam,
		teamHasActiveSubscription: teamHasActiveSubscription_,
		gamesWithStatsCount,
		seasons: team.seasons,
		season,
		player,
		weatherData: weatherDataPromise,
	})
}

const dateFormat = 'MMM d'
function formatLocalIsoDateString(dateIsoString: string) {
	const date = parseISO(dateIsoString)
	const result = format(date, dateFormat)

	return result
}

function isoDateString(timestamp: string) {
	return formatISO(parseISO(timestamp), { representation: 'date' })
}

// Stats table columns are one-per-date, except dates with multiple games
// (tournaments), which get one column per game keyed by the game's full
// timestamp so each game's stats stay separate.
function makeColumnKeys(games: Game[]) {
	const gameCountByDate = new Map<string, number>()
	for (const game of games) {
		if (!game.timestamp) continue
		const date = isoDateString(game.timestamp)
		gameCountByDate.set(date, (gameCountByDate.get(date) ?? 0) + 1)
	}

	function columnKeyForGameTimestamp(timestamp: string) {
		const date = isoDateString(timestamp)
		return (gameCountByDate.get(date) ?? 0) > 1
			? formatISO(parseISO(timestamp))
			: date
	}

	// Entries without a linked game group by their own date, like today
	function columnKeyForStatEntry(statEntry: {
		timestamp: string
		game?: { timestamp: string | null } | null
	}) {
		return statEntry.game?.timestamp
			? columnKeyForGameTimestamp(statEntry.game.timestamp)
			: isoDateString(statEntry.timestamp)
	}

	// Date-only keys are prefixes of same-date timestamp keys, so
	// lexicographic sorting keeps columns in chronological order
	return { columnKeyForGameTimestamp, columnKeyForStatEntry }
}

// Played games get a column even when no stats were recorded — the empty
// column shows the game happened (and breaks streaks)
function pastGameColumnKeys(
	games: { timestamp: string | null; cancelledAt: string | null }[],
	columnKeyForGameTimestamp: (timestamp: string) => string
) {
	return games
		.filter((g) => g.timestamp && !g.cancelledAt && !isFuture(g.timestamp))
		.map((g) => columnKeyForGameTimestamp(g.timestamp!))
}

// Matches the letters used in the "10G 4A" totals column
const statLetter: Record<string, string> = {
	goal: 'G',
	assist: 'A',
}

// Longest run of consecutive stats-table columns containing the same stat
// type — the same definition the 🔥 flames use, so sorting by streak
// matches what's visibly burning in the table. Returns the run length and
// the type that achieved it (goals win ties).
function bestStreak(
	statEntries: { type: string; timestamp: string; game?: { timestamp: string | null } | null }[],
	allColumnKeys: string[],
	columnKeyForStatEntry: (statEntry: {
		timestamp: string
		game?: { timestamp: string | null } | null
	}) => string
) {
	const typesByColumnKey = new Map<string, Set<string>>()
	for (const se of statEntries) {
		const key = columnKeyForStatEntry(se)
		typesByColumnKey.set(key, (typesByColumnKey.get(key) ?? new Set()).add(se.type))
	}

	const bestByType = ['goal', 'assist'].map((type) => {
		let run = 0
		let best = 0
		for (const key of allColumnKeys) {
			run = typesByColumnKey.get(key)?.has(type) ? run + 1 : 0
			best = Math.max(best, run)
		}
		return { type, best }
	})

	const length = Math.max(...bestByType.map((b) => b.best))
	const type =
		length > 0 ? bestByType.find((b) => b.best === length)!.type : null

	return { length, type }
}

// Dates outside the current year get a compact year suffix: "Sep 10 '25"
function columnNeedsYear(columnKey: string) {
	return parseISO(columnKey).getFullYear() !== new Date().getFullYear()
}

// Multi-game dates stack date and time on two fixed lines so the rotated
// label renders the same at every device pixel ratio instead of leaving
// the wrap point up to font metrics. The nowrap wrapper keeps longer
// labels (year suffixes) from wrapping unpredictably too.
function ColumnHeaderLabel({ columnKey }: { columnKey: string }) {
	const date = parseISO(columnKey)
	const dateLabel = columnNeedsYear(columnKey)
		? format(date, `${dateFormat} ''yy`)
		: formatLocalIsoDateString(columnKey)

	return (
		<span className="inline-block text-nowrap leading-tight">
			{dateLabel}
			{columnKey.includes('T') ? (
				<>
					<br />
					{format(date, 'h:mma')}
				</>
			) : null}
		</span>
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
					<DialogTitle>
						Delete {data ? statLabel[data.type] : null}?
					</DialogTitle>
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
	teamSlug,
	teamColor,
	userHasAccessToTeam,
	player,
	columnKeys,
	columnKeyForStatEntry,
	gameIdByColumnKey,
}: {
	teamSlug: string
	teamColor: string
	userHasAccessToTeam: boolean
	player: PlayerWithStats
	columnKeys: () => string[]
	columnKeyForStatEntry: (statEntry: {
		timestamp: string
		game?: { timestamp: string | null } | null
	}) => string
	gameIdByColumnKey: Map<string, number>
}) {
	const [statDeleteDialog, setStatDeleteDialog] =
		useState<StatDeleteDialogData>(null)

	const sort =
		new URLSearchParams(useLocation().search).get('sort') ?? 'goals'

	const goalCount = player.statEntries.filter((s) => s.type === 'goal').length
	const assistCount = player.statEntries.filter(
		(s) => s.type === 'assist'
	).length
	const streak =
		sort === 'streak'
			? bestStreak(player.statEntries, columnKeys(), columnKeyForStatEntry)
			: null
	const statEntriesByColumn: [string, StatEntry[]][] = player.statEntries.reduce(
		(acc: [string, StatEntry[]][], se) => {
			const columnKey = columnKeyForStatEntry(se)
			const columnEntryPair = acc.find(([k]) => k === columnKey)
			invariant(columnEntryPair, 'columnEntryPair not found')
			columnEntryPair[1]?.push(se)

			return acc
		},
		columnKeys().map((k) => [k, []])
	)

	const missedGameIds = new Set(
		player.rsvps
			.filter((r) => r.rsvp === 'no')
			.map((r) => r.gameId)
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
						<PopoverContent>
							<Link to={`/${teamSlug}/players/${player.id}`} className="hover:underline">
								{player.name}
							</Link>
						</PopoverContent>
					</Popover>
				</td>
				<td className="hidden md:table-cell">
					<Link to={`/${teamSlug}/players/${player.id}`} className="hover:underline">
						{player.name}
					</Link>
				</td>
				{statEntriesByColumn.map(([columnKey, entries], columnIndex) => (
					<td
						key={columnKey}
						className={cn(
							'text-center text-nowrap',
							columnIndex !== statEntriesByColumn.length - 1
								? 'border-r border-green-900/25 border-dashed'
								: null,
							`has-[.stat]:bg-${teamColor}-100`
						)}
					>
						{entries.map(({ id, type, timestamp }, i) => {
							const localTimestamp = parseISO(timestamp)

							const isStreak =
								(columnIndex !== 0 &&
									statEntriesByColumn[columnIndex - 1][1].some(
										(se) => se.type === type
									)) ||
								(columnIndex !== statEntriesByColumn.length - 1 &&
									statEntriesByColumn[columnIndex + 1][1].some(
										(se) => se.type === type
									))

							return (
								<Popover key={id}>
									<PopoverTrigger>
										<span
											className={cn(
												'stat inline-block relative text-xs',
												isStreak ? 'streak' : null,
												i !== 0 ? '-ml-2' : null
											)}
										>
											{statEmoji[type]}
										</span>
									</PopoverTrigger>
									<PopoverContent className="space-y-3">
										<div>
											{upperFirst(statLabel[type])} by {player.name} on{' '}
											{format(localTimestamp, dateFormat)}
										</div>
										{userHasAccessToTeam ? (
											<div className="flex gap-1 text-center">
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
						{entries.length === 0 &&
							missedGameIds.has(gameIdByColumnKey.get(columnKey) ?? -1) && (
								<Popover>
									<PopoverTrigger>
										<span className="text-xs opacity-40">🚫</span>
									</PopoverTrigger>
									<PopoverContent>
										{player.name} missed this game
									</PopoverContent>
								</Popover>
							)}
					</td>
				))}
				<td
					className={`text-xl text-right text-nowrap sticky right-0 bg-${teamColor}-50`}
				>
					{streak !== null
						? streak.length > 1
							? `${streak.length}${statLetter[streak.type!] ?? ''}`
							: '-'
						: player.statEntries.length === 0
						? '-'
						: `${goalCount}G ${assistCount}A`}
				</td>
			</tr>
			<StatDeleteDialog
				show={Boolean(statDeleteDialog)}
				closeDialog={() => setStatDeleteDialog(null)}
				data={statDeleteDialog}
			/>
		</>
	)
}

function AddStatsButton({
	teamId,
	players,
	games,
}: {
	teamId: number
	players: PlayerWithStats[]
	games: Game[]
}) {
	const datepickerTimestampString = () => formatISO(new Date()).slice(0, 16) // Chop off offset and seconds

	const [dialogOpen, setDialogOpen] = useState(false)
	const fetcher = useFetcher<number>()
	const aiFetcher = useFetcher<Omit<StatEntry, 'id'>[]>()
	const [stats, setStats] = useState<Omit<StatEntry, 'id'>[]>([])
	const [textInput, setTextInput] = useState('')
	const [selectedGameId, setSelectedGameId] = useState<string | null>(() =>
		games.length === 0 ? 'manual' : null
	)

	const [datepickerValue, setDatepickerValue] = useState(
		datepickerTimestampString
	)
	const [timestampValue, setTimestampValue] = useState(() =>
		formatISO(parseISO(datepickerTimestampString()))
	)
	const [aiInputOpen, setAiInputOpen] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const isSubmitting = fetcher.state === 'submitting'

	// Error response from the action (paywall or one-award-per-game guard)
	const errorData =
		fetcher.state === 'idle' &&
		fetcher.data &&
		typeof fetcher.data === 'object' &&
		'error' in fetcher.data
			? (fetcher.data as { error: string; paywall?: boolean })
			: null

	useEffect(() => {
		if (aiInputOpen && textareaRef.current) {
			textareaRef.current.focus()
		}
	}, [aiInputOpen])

	useEffect(() => {
		if (dialogOpen) {
			setStats([])
			const newDatepickerValue = datepickerTimestampString()
			setDatepickerValue(newDatepickerValue)
			const newTimestamp = formatISO(parseISO(newDatepickerValue))
			setTimestampValue(newTimestamp)
		}
	}, [dialogOpen])

	// Close when a save lands. Gated on 'idle' rather than 'loading': fast
	// dev loaders let the fetcher pass through 'loading' without React
	// committing a render there, which left the dialog stuck open. 'idle' is
	// terminal so it can't be missed, and because this effect depends on
	// nothing but the fetcher, stale success data from an earlier save can't
	// re-close a reopened dialog. On error, stay open and show the alert
	useEffect(() => {
		if (fetcher.state !== 'idle' || fetcher.data === undefined) {
			return
		}
		const hasError =
			fetcher.data &&
			typeof fetcher.data === 'object' &&
			'error' in fetcher.data
		if (!hasError) {
			setDialogOpen(false)
		}
	}, [fetcher.data, fetcher.state])

	// A manual-date save creates the game; adopt its ID as the selection
	useEffect(() => {
		if (selectedGameId === 'manual' && typeof fetcher.data === 'number') {
			setSelectedGameId(fetcher.data.toString())
		}
	}, [fetcher.data, selectedGameId])

	useEffect(() => {
		if (aiFetcher.state === 'idle' && aiFetcher.data) {
			// Handle daily limit error
			if (typeof aiFetcher.data === 'object' && 'error' in aiFetcher.data) {
				return
			}
			setStats(aiFetcher.data)
			setTextInput('')
			setAiInputOpen(false)
		}
	}, [aiFetcher.data, aiFetcher.state])

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

	// All saved entries for the selected game, across players (Number() of
	// 'manual' or null is NaN, which matches nothing)
	const savedStatsForSelectedGame = players.flatMap((p) =>
		p.statEntries.filter((se) => se.gameId === Number(selectedGameId))
	)

	function addStat(playerId: number, type: StatEntry['type']) {
		setStats((stats) => [
			// Award stats are one per game: adding one moves it to this player
			...((oncePerGameStatTypes as readonly string[]).includes(type)
				? stats.filter((s) => s.type !== type)
				: stats),
			{
				playerId,
				timestamp: timestampValue,
				type,
				gameId: selectedGameId === 'manual' ? null : Number(selectedGameId),
			},
		])
	}

	function submit(e: MouseEvent) {
		e.preventDefault()

		fetcher.submit(JSON.stringify(stats), {
			encType: 'application/json',
			action: '/stats',
			method: 'post',
		})
		mixpanel.track('add stats', {
			goals: stats.filter((s) => s.type === 'goal').length,
			assists: stats.filter((s) => s.type === 'assist').length,
			mvps: stats.filter((s) => s.type === 'mvp').length,
			cleanSheets: stats.filter((s) => s.type === 'clean_sheet').length,
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
				{game.opponent ? `vs ${game.opponent}` : null}
			</SelectItem>
		)
	}

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<Button
				size="icon"
				aria-label="Add stats"
				onClick={() => {
					setDialogOpen(true)
					mixpanel.track('open add stats dialog')
				}}
			>
				<Add />
			</Button>
			<DialogContent className="flex flex-col h-dvh w-dvw max-w-none sm:h-auto sm:max-h-[95dvh] sm:w-[92dvw] sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add stats</DialogTitle>
				</DialogHeader>

				{errorData && (
					<Alert variant="destructive">
						<AlertDescription className="space-y-2">
							<p>{errorData.error}</p>
							{errorData.paywall ? (
								<>
									<p className="text-sm">
										<span className="font-semibold">
											Early access pricing, 50% off:
										</span>{' '}
										<span className="line-through opacity-70">$39</span>{' '}
										<span className="font-medium">$19/year</span>
									</p>
									<Button asChild size="sm">
										<a href={`/teams/${teamId}/subscribe`}>Subscribe</a>
									</Button>
								</>
							) : null}
						</AlertDescription>
					</Alert>
				)}

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

				<Collapsible open={aiInputOpen} onOpenChange={setAiInputOpen}>
					<div className="sm:flex sm:flex-row-reverse">
						<CollapsibleTrigger asChild>
							<Button
								type="button"
								variant="secondary"
								disabled={
									!selectedGameId ||
									isSubmitting ||
									aiFetcher.state === 'submitting'
								}
							>
								Describe stats
								<ChevronDown
									className={cn(
										'size-4 transition-transform duration-200',
										aiInputOpen ? '' : 'rotate-90'
									)}
								/>
							</Button>
						</CollapsibleTrigger>
					</div>

					<CollapsibleContent className="space-y-2 mt-2">
						<Textarea
							ref={textareaRef}
							placeholder="Describe who scored (e.g., 'Mario scored 2 goals, Luigi had 1 assist')"
							value={textInput}
							onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
								setTextInput(e.target.value)
							}
							disabled={isSubmitting || aiFetcher.state === 'submitting'}
							aria-label="Describe game statistics"
						/>
						{typeof aiFetcher.data === 'object' && 'error' in aiFetcher.data ? (
							<p className="text-sm text-red-600 mb-2 sm:text-right">
								Rate limit was hit. Try again later.
							</p>
						) : null}
						<div className="sm:flex sm:flex-row-reverse">
							<Button
								type="button"
								variant="secondary"
								onClick={() => {
									if (!textInput.trim() || !selectedGameId) return

									aiFetcher.submit(
										{
											text: textInput,
											players: players.map((p) => ({ id: p.id, name: p.name })),
											gameId:
												selectedGameId === 'manual' ? null : selectedGameId,
											timestamp: timestampValue,
										},
										{
											action: '/parse-stats',
											method: 'post',
											encType: 'application/json',
										}
									)
								}}
								disabled={
									!textInput.trim() ||
									!selectedGameId ||
									isSubmitting ||
									aiFetcher.state === 'submitting'
								}
							>
								Parse
								{aiFetcher.state === 'submitting' ? (
									<LoaderCircle className="size-4 animate-spin" />
								) : (
									<Sparkles className="size-4" />
								)}
							</Button>
						</div>
					</CollapsibleContent>
				</Collapsible>

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
									className="grid grid-cols-[1fr_auto_auto] gap-3 items-center"
								>
									<div>{player.name}</div>
									<div>
										<div className="text-[0.6rem]">
											{Object.keys(statEmoji).map((type) => {
												const count = savedStatsForSelectedGame.filter(
													(s) =>
														s.playerId === player.id && s.type === type
												).length
												return count ? (
													<span key={type}>
														{count}
														{statEmoji[type]}{' '}
													</span>
												) : null
											})}
										</div>
										<div>
											{stats.some((s) => s.playerId === player.id)
												? '+'
												: null}
											{Object.keys(statEmoji).map((type) => {
												const count = stats.filter(
													(s) =>
														s.playerId === player.id && s.type === type
												).length
												return count ? (
													<span key={type}>
														{count}
														{statEmoji[type]}{' '}
													</span>
												) : null
											})}
										</div>
									</div>
									<div className="flex gap-1 justify-end">
										<Button
											type="button"
											size="icon"
											variant="secondary"
											className="relative"
											onClick={() => addStat(player.id, 'assist')}
										>
											🍎
											<Add className={cn('absolute top-0 right-0 size-4')} />
										</Button>
										<Button
											type="button"
											size="icon"
											variant="secondary"
											className="relative"
											onClick={() => addStat(player.id, 'goal')}
										>
											⚽️
											<Add className={cn('absolute top-0 right-0 size-4')} />
										</Button>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													type="button"
													size="icon"
													variant="secondary"
													aria-label="More stat types"
												>
													<MoreHorizontal />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{oncePerGameStatTypes.map((type) => (
													<DropdownMenuItem
														key={type}
														onClick={() => addStat(player.id, type)}
													>
														{statEmoji[type]}{' '}
														{upperFirst(statLabel[type])}
													</DropdownMenuItem>
												))}
											</DropdownMenuContent>
										</DropdownMenu>
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


function SortDropdown() {
	const path = useLocation().pathname
	const navigate = useNavigate()
	const searchParams = new URLSearchParams(useLocation().search)
	const sort = searchParams.get('sort') ?? 'goals'

	const sortLabel = {
		name: 'Name',
		goals: 'Most goals',
		assists: 'Most assists',
		contributions: 'Most contributions',
		streak: 'Best streak',
	}[sort]

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="secondary">
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
					<DropdownMenuRadioItem value="contributions">
						Contributions
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="streak">Streak</DropdownMenuRadioItem>
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
		gamesWithStatsCount,
		season,
		seasons,
		player,
		weatherData,
	} = useLoaderData<typeof loader>()
	const { players } = team

	const { columnKeyForGameTimestamp, columnKeyForStatEntry } = makeColumnKeys(
		team.games
	)

	const gameIdByColumnKey = new Map<string, number>(
		team.games
			.filter((g) => g.timestamp)
			.map((g) => [columnKeyForGameTimestamp(g.timestamp!), g.id])
	)

	function columnKeys() {
		return Array.from(
			new Set([
				...pastGameColumnKeys(team.games, columnKeyForGameTimestamp),
				...players.flatMap((p) => p.statEntries.map(columnKeyForStatEntry)),
			])
		).toSorted() as string[]
	}

	// Time-stacked and year-suffixed labels need a taller header row
	const hasLongHeaderLabels = columnKeys().some(
		(k) => k.includes('T') || columnNeedsYear(k)
	)

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
			<TrialStatus
				teamId={team.id}
				gamesWithStatsCount={gamesWithStatsCount}
				hasActiveSubscription={Boolean(teamHasActiveSubscription)}
			/>
			{nextGame ? (
				<Collapsible className="space-y-3" defaultOpen>
					<CollapsibleTrigger asChild>
						<div className="flex w-full place-items-center cursor-pointer">
							<h2 className="text-2xl flex-grow text-left">Next game</h2>
							<Button size="icon" variant="ghost">
								<ChevronsUpDown />
							</Button>
						</div>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<GameCard
							game={nextGame}
							team={team}
							userHasAccessToTeam={userHasAccessToTeam}
							player={player}
							nextGame
							weatherData={weatherData}
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
								teamId={team.id}
								players={players}
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
								{columnKeys().map((columnKey) => {
									const game = team.games.find(
										(g) =>
											g.timestamp &&
											columnKeyForGameTimestamp(g.timestamp) === columnKey
									)
									return (
										<th
											key={columnKey}
											className={cn(
												'text-xs rotate-45',
												hasLongHeaderLabels ? 'h-14' : 'h-10'
											)}
										>
											{game && game.statEntries.length > 0 ? (
												<StatsDialog game={game} statEntries={game.statEntries} player={player}>
													<button className="cursor-pointer hover:underline">
														<ColumnHeaderLabel columnKey={columnKey} />
													</button>
												</StatsDialog>
											) : (
												<ColumnHeaderLabel columnKey={columnKey} />
											)}
										</th>
									)
								})}
								{/* Totals */}
								<th className={`sticky right-0 bg-${team.color}-50 z-10`}></th>
							</tr>
						</thead>
						<tbody>
							{players.map((p) => (
								<PlayerRow
									key={p.id}
									teamSlug={team.slug}
									teamColor={team.color}
									userHasAccessToTeam={userHasAccessToTeam}
									player={p}
									columnKeys={columnKeys}
									columnKeyForStatEntry={columnKeyForStatEntry}
									gameIdByColumnKey={gameIdByColumnKey}
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
						teamId={team.id}
						players={players}
						games={team.games}
					/>
				) : null}
			</div>
			<footer className="text-center pt-8 pb-24">
				<a
					href="/"
					className="text-sm underline"
				>
					Powered by TeamStats
				</a>
			</footer>
			<Toaster />
		</>
	)
}
