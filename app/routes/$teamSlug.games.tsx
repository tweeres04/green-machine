import { LoaderFunctionArgs, MetaArgs, MetaFunction } from '@remix-run/node'
import {
	json,
	useFetcher,
	useLoaderData,
	useLocation,
	useNavigate,
} from '@remix-run/react'
import { endOfDay, format, formatISO, parseISO } from 'date-fns'
import invariant from 'tiny-invariant'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import Nav from '~/components/ui/nav'
import { getDb } from '~/lib/getDb'
import { z } from 'zod'
import { LoaderCircle, ChevronDown, Share } from 'lucide-react'

import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogClose,
	DialogDescription,
} from '~/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from '~/components/ui/dropdown-menu'

import More from '~/components/ui/icons/more'
import { ReactNode, useEffect, useState } from 'react'
import { cn } from '~/lib/utils'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { teamHasActiveSubscription } from '~/lib/teamHasActiveSubscription'
import { createInsertSchema } from 'drizzle-zod'
import { games, Team } from '~/schema'
import _ from 'lodash'
import { useToast } from '~/components/ui/use-toast'

export const meta: MetaFunction = ({ data }: MetaArgs) => {
	const {
		team: { name, slug },
	} = data as { team: Team }

	const title = `${name} games - TeamStats`
	const description = `Games for ${name}. Next game, past games, and upcoming games. Shareable next game.`
	const url = `https://teamstats.tweeres.com/${slug}/games`

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

type Game = Awaited<
	ReturnType<Awaited<ReturnType<typeof loader>>['json']>
>['team']['games'][0]

type Player = Awaited<
	ReturnType<Awaited<ReturnType<typeof loader>>['json']>
>['team']['players'][0]

function RsvpForm({
	player,
	closeModal,
	game,
}: {
	player: Player
	closeModal?: () => void
	game: Game
}) {
	const fetcher = useFetcher()
	const saving = fetcher.state !== 'idle'

	const rsvp = player.rsvps.find((rsvp) => rsvp.gameId === game.id)

	useEffect(() => {
		if (closeModal && fetcher.state === 'loading') {
			closeModal()
		}
	}, [closeModal, fetcher.state])

	const action = rsvp
		? `/games/${game.id}/rsvps/${rsvp.id}`
		: `/games/${game.id}/rsvps`

	const method = rsvp ? 'patch' : 'post'

	return (
		<fieldset className="space-y-3" disabled={saving}>
			<label htmlFor="timestamp_input" className="block">
				Are you going?
			</label>
			<DialogFooter>
				<Button variant="secondary" onClick={closeModal}>
					Cancel
				</Button>{' '}
				<fetcher.Form action={action} method={method}>
					<input type="hidden" name="value" value="no" />
					<Button variant="destructive" className="w-full sm:w-auto">
						No
					</Button>
				</fetcher.Form>{' '}
				<fetcher.Form action={action} method={method}>
					<input type="hidden" name="value" value="yes" />
					<Button className="w-full sm:w-auto">Yes</Button>
				</fetcher.Form>
			</DialogFooter>
		</fieldset>
	)
}

function GameForm({
	closeModal,
	game,
	teamId,
}: {
	closeModal: () => void
	game?: Game
	teamId?: number
}) {
	invariant(game || teamId, 'game or teamId is required')

	const fetcher = useFetcher()
	const datepickerTimestampString = (
		game?.timestamp ?? formatISO(new Date())
	).slice(0, 16) // Chop off offset
	const saving = fetcher.state !== 'idle'

	useEffect(() => {
		if (fetcher.state === 'loading') {
			closeModal()
		}
	}, [closeModal, fetcher.state])

	return (
		<fetcher.Form
			action={game ? `/games/${game.id}` : '/games'}
			method={game ? 'put' : 'post'}
		>
			{game ? null : <input type="hidden" name="team_id" value={teamId} />}
			<fieldset className="space-y-3" disabled={saving}>
				<div>
					<label htmlFor="timestamp_input">Date and time</label>
					<Input
						type="datetime-local"
						step="60"
						id="timestamp_input"
						defaultValue={datepickerTimestampString}
						onChange={(e) => {
							const timestampInput =
								e.target.parentElement?.querySelector<HTMLInputElement>(
									'#hidden_timestamp_input' // I should use a ref at some point
								)
							invariant(timestampInput, 'timestampInput not found')
							timestampInput.value = formatISO(e.target.value)
						}}
					/>
					<input
						type="hidden"
						name="timestamp"
						id="hidden_timestamp_input"
						defaultValue={formatISO(datepickerTimestampString)}
					/>
				</div>
				<div>
					<label htmlFor="opponent_input">Opponent</label>
					<Input
						id="opponent_input"
						required
						name="opponent"
						defaultValue={game?.opponent}
					/>
				</div>
				<div>
					<label htmlFor="location_input">Location</label>
					<Input
						id="location_input"
						name="location"
						defaultValue={game?.location ?? undefined}
					/>
				</div>
				<DialogFooter>
					<Button type="submit" className="w-full">
						{game ? 'Update' : 'Add'}
					</Button>
				</DialogFooter>
			</fieldset>
		</fetcher.Form>
	)
}

function CancelForm({
	closeModal,
	game,
}: {
	closeModal: () => void
	game: Game
}) {
	const fetcher = useFetcher()

	const saving = fetcher.state !== 'idle'

	useEffect(() => {
		if (fetcher.data?.changes === 1 && fetcher.state !== 'submitting') {
			closeModal()
		}
	}, [closeModal, fetcher.data?.changes, fetcher.state])

	return (
		<fieldset disabled={saving}>
			<DialogFooter>
				<Button variant="secondary" onClick={closeModal}>
					Close
				</Button>
				<fetcher.Form action={`/games/${game.id}`} method="patch">
					<input
						type="hidden"
						name="cancelledAt"
						defaultValue={game.cancelledAt ?? undefined}
						id="hidden_cancelledAt_input"
					/>
					<Button
						variant={game.cancelledAt ? 'default' : 'destructive'}
						type="submit"
						className="w-full sm:w-auto"
						onClick={() => {
							const cancelledAtInput = document.getElementById(
								'hidden_cancelledAt_input'
							) as HTMLInputElement
							invariant(cancelledAtInput, 'cancelledAtInput not found')
							cancelledAtInput.value = game.cancelledAt
								? ''
								: formatISO(new Date())
						}}
					>
						{game.cancelledAt ? 'Uncancel' : 'Cancel'} game
					</Button>
				</fetcher.Form>
			</DialogFooter>
		</fieldset>
	)
}

const GameResultSchema = z.object({
	games: createInsertSchema(games).omit({ teamId: true }).array(),
})

function ImportScheduleForm({
	closeModal,
	teamId,
}: {
	closeModal: () => void
	teamId: number
}) {
	const fetcher = useFetcher()
	const saving = fetcher.state !== 'idle'

	const parseResult = GameResultSchema.safeParse(fetcher.data)
	const games = parseResult.success ? parseResult.data.games : null

	return games ? (
		games.length > 0 ? (
			<>
				<p>We found these games:</p>
				<table className="w-full">
					<thead>
						<tr>
							<th>Date and time</th>
							<th>Opponent</th>
							<th>Location</th>
						</tr>
					</thead>
					<tbody>
						{games.map((game) => (
							<tr key={game.timestamp}>
								<td>
									{game.timestamp
										? format(game.timestamp, "E MMM d 'at' h:mma")
										: 'TBD'}
								</td>
								<td>{game.opponent}</td>
								<td>{game.location ?? 'TBD'}</td>
							</tr>
						))}
					</tbody>
				</table>
				<DialogFooter>
					<Button onClick={closeModal} variant="secondary">
						Cancel
					</Button>
					<fetcher.Form action="/import-schedule/confirm" method="post">
						<input type="hidden" name="games" value={JSON.stringify(games)} />
						<input type="hidden" name="team_id" value={teamId} />
						<Button type="submit" onClick={closeModal}>
							Import games
						</Button>
					</fetcher.Form>
				</DialogFooter>
			</>
		) : (
			<p>Couldn't find any games</p>
		)
	) : (
		<fetcher.Form action="/import-schedule" method="post">
			<fieldset className="space-y-3" disabled={saving}>
				<div>
					<label htmlFor="schedule_url_input">Schedule URL</label>
					<Input
						id="schedule_url_input"
						required
						name="schedule_url"
						type="url"
						defaultValue="https://vssc.leaguelab.com/league/80834/schedule"
					/>
				</div>
				<div>
					<label htmlFor="team_name_input">Team Name</label>
					<Input
						id="team_name_input"
						required
						name="team_name"
						type="text"
						defaultValue="Green Machine"
					/>
				</div>
				{(() => {
					const footer = (
						<DialogFooter>
							<Button type="submit" className="w-full">
								Submit
							</Button>
						</DialogFooter>
					)
					return fetcher.state === 'submitting' ? (
						<div className="flex items-center">
							<div className="flex flex-grow items-center">
								Importing with AI
								<LoaderCircle className="ml-2 animate-spin" />
							</div>
							{footer}
						</div>
					) : (
						footer
					)
				})()}
			</fieldset>
		</fetcher.Form>
	)
}

function MoreButton({
	userHasAccessToTeam,
	game,
	player,
	teamHasActiveSubscription,
}: {
	userHasAccessToTeam: boolean
	game: Game
	player?: Player
	teamHasActiveSubscription: boolean
}) {
	const fetcher = useFetcher()
	const [dialogTitle, setDialogTitle] = useState<string | null>(null)
	const [dialogDescription, setDialogDescription] = useState<string | null>(
		null
	)
	const [dialogContent, setDialogContent] = useState<ReactNode | null>(null)

	const dialogOpen = Boolean(dialogTitle && dialogContent)

	function closeModal() {
		setDialogTitle(null)
		setDialogContent(null)
	}

	return (
		<Dialog
			open={dialogOpen}
			onOpenChange={(value) => {
				if (!value) {
					closeModal()
				}
			}}
		>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="icon" variant="secondary">
						<More />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{player ? (
						<DropdownMenuItem
							onClick={() => {
								setDialogTitle(`RSVP to game against ${game.opponent}`)
								setDialogDescription(
									`${game.location ?? 'Location TBD'}, ${
										game.timestamp
											? format(game.timestamp, "E MMM d 'at' h:mma")
											: 'date and time TBD'
									}`
								)
								setDialogContent(
									<RsvpForm
										player={player}
										game={game}
										closeModal={closeModal}
									/>
								)
							}}
							disabled={!teamHasActiveSubscription}
						>
							RSVP
						</DropdownMenuItem>
					) : null}
					{userHasAccessToTeam ? (
						<DropdownMenuItem
							onClick={() => {
								setDialogTitle(`Edit game against ${game.opponent}`)
								setDialogContent(
									<GameForm game={game} closeModal={closeModal} />
								)
							}}
						>
							Edit
						</DropdownMenuItem>
					) : null}
					{userHasAccessToTeam ? (
						<fetcher.Form>
							<DropdownMenuItem
								onClick={() => {
									setDialogTitle(
										`${game.cancelledAt ? 'Uncancel' : 'Cancel'} game against ${
											game.opponent
										}?`
									)
									setDialogContent(
										<CancelForm closeModal={closeModal} game={game} />
									)
								}}
								disabled={!teamHasActiveSubscription}
							>
								{game.cancelledAt ? 'Uncancel' : 'Cancel'}
							</DropdownMenuItem>
						</fetcher.Form>
					) : null}
					{userHasAccessToTeam ? (
						<DropdownMenuItem
							onClick={() => {
								setDialogTitle('Are you sure?')
								setDialogDescription('This action cannot be undone.')
								setDialogContent(
									<DialogFooter>
										<DialogClose asChild>
											<Button variant="secondary" type="button">
												Cancel
											</Button>
										</DialogClose>
										<fetcher.Form
											method="delete"
											action={`/games/${game.id}/destroy`}
										>
											<Button
												variant="destructive"
												className="w-full sm:w-auto"
											>
												Remove
											</Button>
										</fetcher.Form>
									</DialogFooter>
								)
							}}
							disabled={!teamHasActiveSubscription}
						>
							Remove game
						</DropdownMenuItem>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			<DialogContent>
				<DialogHeader>
					<DialogTitle>{dialogTitle}</DialogTitle>
					{dialogDescription ? (
						<DialogDescription>{dialogDescription}</DialogDescription>
					) : null}
				</DialogHeader>
				{dialogContent}
			</DialogContent>
		</Dialog>
	)
}

function RsvpDialog({
	children,
	rsvps,
	players,
}: {
	children: ReactNode
	rsvps: Game['rsvps']
	players: Player[]
}) {
	const rsvpInfo = [
		{
			rsvp: 'Yes',
			players: players.filter((p) =>
				rsvps.some((r) => (r.playerId === p.id && r.rsvp) === 'yes')
			),
		},
		{
			rsvp: 'No',
			players: players.filter((p) =>
				rsvps.some((r) => (r.playerId === p.id && r.rsvp) === 'no')
			),
		},
		{
			rsvp: 'TBD',
			players: players.filter((p) => !rsvps.some((r) => r.playerId === p.id)),
		},
	]

	return (
		<Dialog>
			<DialogTrigger>{children}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>RSVPs</DialogTitle>
				</DialogHeader>
				<div className="space-y-1">
					{rsvpInfo.map(({ rsvp, players }) => {
						if (players.length === 0) {
							return null
						}
						return (
							<div key={rsvp}>
								<div className="font-bold">
									{rsvp} ({players.length})
								</div>
								<ul>
									{players.map((player) => (
										<li key={player.id}>{player.name}</li>
									))}
								</ul>
							</div>
						)
					})}
				</div>
				<DialogFooter>
					<DialogClose>
						<Button>Done</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function StatsDialog({
	children,
	statEntries,
	game,
}: {
	children: ReactNode
	statEntries: Game['statEntries']
	game: Game
	players: Player[]
}) {
	const groupedStats = _.groupBy(statEntries, 'playerId')

	const formattedDate = game.timestamp
		? format(game.timestamp, 'E MMM d')
		: 'TBD'
	const formattedTime = game.timestamp ? format(game.timestamp, 'h:mma') : 'TBD'

	const sortedGroupedStats = Object.entries(groupedStats).toSorted(
		([, a], [, b]) => a[0].player.name.localeCompare(b[0].player.name)
	)

	return (
		<Dialog>
			<DialogTrigger>{children}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{game.opponent} - {formattedDate} at {formattedTime}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-1">
					{sortedGroupedStats.map(([playerId, entries]) => {
						const player = entries[0].player
						const goals = entries.filter(
							(entry) => entry.type === 'goal'
						).length
						const assists = entries.filter(
							(entry) => entry.type === 'assist'
						).length
						return (
							<div
								key={playerId}
								className="grid grid-cols-2 sm:grid-cols-[1fr_3fr]"
							>
								<div>{player.name}:</div>
								<div>
									{goals > 0 && `${goals} goal${goals === 1 ? '' : 's'}`}
									{goals > 0 && assists > 0 && ', '}
									{assists > 0 &&
										`${assists} assist${assists === 1 ? '' : 's'}`}
								</div>
							</div>
						)
					})}
				</div>
				<DialogFooter>
					<DialogClose>
						<Button>Done</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const { teamSlug } = params
	invariant(teamSlug, 'Missing teamSlug parameter')

	const userPromise = authenticator.isAuthenticated(request)

	const db = getDb()

	const searchParams = new URL(request.url).searchParams
	const seasonId = searchParams.get('season')

	const season = seasonId
		? await db.query.seasons.findFirst({
				where: (seasons, { eq }) => eq(seasons.id, parseInt(seasonId)),
		  })
		: null

	const teamPromise = db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
		with: {
			games: {
				orderBy: (games, { asc }) => asc(games.timestamp),
				with: {
					rsvps: true,
					statEntries: {
						with: {
							player: true,
						},
					},
				},
				where: season
					? (statEntries, { and, gte, lte }) => {
							let endOfSeasonEndDay: Date | string = parseISO(season.endDate)
							endOfSeasonEndDay = endOfDay(endOfSeasonEndDay)
							endOfSeasonEndDay = formatISO(endOfSeasonEndDay)

							// this _may_ fail across dst since sqlite does a string comparison (but I'll tackle that if it actually happens)
							return and(
								gte(statEntries.timestamp, season.startDate),
								lte(statEntries.timestamp, endOfSeasonEndDay)
							)
					  }
					: undefined,
			},
			players: {
				with: {
					rsvps: true,
					userInvite: true,
				},
			},
			subscription: true,
			seasons: true,
		},
	})

	const [user, team] = await Promise.all([userPromise, teamPromise])

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)

	const player = user
		? team.players.find((player) => player.userInvite?.userId === user.id)
		: null

	const teamHasActiveSubscription_ = teamHasActiveSubscription(team)

	const userIsTylerOrMelissa = [1, 2].includes(user?.id ?? -1)

	return json({
		userIsTylerOrMelissa,
		team,
		userHasAccessToTeam,
		player,
		teamHasActiveSubscription: teamHasActiveSubscription_,
		seasons: team.seasons,
		season,
	})
}

function SeasonDropdown({
	seasons,
	season,
}: {
	seasons: { id: number; name: string }[]
	season: { id: number; name: string } | null
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

type GameRowProps = {
	game: Game
	team: Team & { players: Player[] }
	userHasAccessToTeam: boolean
	player: Player
	teamHasActiveSubscription: boolean
}

function GameRow({
	game,
	team,
	userHasAccessToTeam,
	player,
	teamHasActiveSubscription,
}: GameRowProps) {
	const yeses = game.rsvps.filter((r) => r.rsvp === 'yes').length
	const nos = game.rsvps.filter((r) => r.rsvp === 'no').length
	return (
		<tr key={game.id}>
			<td className="relative">
				<div className={cn(game.cancelledAt ? 'line-through' : null)}>
					{game.timestamp
						? format(game.timestamp, "E MMM d 'at' h:mma")
						: 'TBD'}
				</div>
			</td>
			<td className={cn(game.cancelledAt ? 'line-through' : null)}>
				{game.opponent}
			</td>
			<td className={cn(game.cancelledAt ? 'line-through' : null)}>
				{game.location}
			</td>
			<td className={cn(game.cancelledAt ? 'line-through' : null)}>
				<RsvpDialog rsvps={game.rsvps} players={team.players}>
					{yeses > 0 ? <div className="font-bold">{yeses} yes</div> : null}
					{nos > 0 ? <div>{nos} no</div> : null}
					<div>{team.players.length - game.rsvps.length} TBD</div>
				</RsvpDialog>
			</td>
			<td className="text-center">
				{(() => {
					const goals = game.statEntries.filter(
						(se) => se.type === 'goal'
					).length
					const assists = game.statEntries.filter(
						(se) => se.type === 'assist'
					).length

					if (!goals && !assists) {
						return <>-</>
					}
					return (
						<StatsDialog
							statEntries={game.statEntries}
							game={game}
							players={team.players}
						>
							{goals} goal{goals === 1 ? '' : 's'}, {assists} assist
							{assists === 1 ? '' : 's'}
						</StatsDialog>
					)
				})()}
			</td>
			{userHasAccessToTeam || player ? (
				<td className={`bg-${team.color}-50 sticky right-0`}>
					<MoreButton
						userHasAccessToTeam={userHasAccessToTeam}
						game={game}
						player={player}
						teamHasActiveSubscription={teamHasActiveSubscription}
					/>
				</td>
			) : null}
		</tr>
	)
}

function ShareNextGameButton({
	teamName,
	slug,
	nextGame,
}: {
	teamName: string
	slug: string
	nextGame: Game
}) {
	const { toast } = useToast()
	const location = useLocation()

	const shareAvailable = typeof window !== 'undefined' && 'share' in navigator

	const title = `${teamName} Next Game`
	const url = `https://teamstats.tweeres.com/${slug}/games${location.search}`
	const gameDetails = `${nextGame.opponent} ${
		nextGame.timestamp
			? format(parseISO(nextGame.timestamp), "'on' E MMM d 'at' h:mma")
			: 'TBD'
	} at ${nextGame.location ?? 'TBD'}`

	return (
		<Button
			title="Share next game"
			variant="secondary"
			size="icon"
			onClick={async () => {
				if (shareAvailable) {
					await navigator.share({
						title,
						text: gameDetails,
						url,
					})
				} else {
					await window.navigator.clipboard.writeText(`${title}:

${gameDetails}

${url}`)
					toast({
						description: 'Next game details copied to clipboard',
					})
				}
			}}
		>
			{<Share />}
		</Button>
	)
}

export default function Games() {
	const {
		userIsTylerOrMelissa,
		team,
		userHasAccessToTeam,
		player,
		teamHasActiveSubscription,
		season,
		seasons,
	} = useLoaderData<typeof loader>()
	const [newGameModal, setNewGameModal] = useState(false)
	const [importScheduleModal, setImportScheduleModal] = useState(false)

	const now = new Date()
	const upcomingGames = team.games.filter(
		(game) => game.timestamp && new Date(game.timestamp) > now
	)
	const pastGames = team.games
		.filter((game) => game.timestamp && new Date(game.timestamp) <= now)
		.reverse()
	const nextGame = upcomingGames.shift()

	return (
		<>
			<Nav title="Games" team={team} />
			<div className="flex gap-1 mb-3 items-center">
				<div className="grow flex flex-col sm:flex-row gap-1">
					{seasons.length > 0 && (
						<SeasonDropdown seasons={seasons} season={season} />
					)}
				</div>
			</div>
			{team.games.length > 0 ? (
				<div className="w-full overflow-x-auto">
					<table className="w-full [&_td]:pt-2 [&_tbody_th]:pt-2 [&_th:not(:first-child)]:pl-3 [&_td:not(:first-child)]:pl-3">
						<thead>
							<tr className="[&_th]:text-left">
								<th>Date/time</th>
								<th>Opponent</th>
								<th>Location</th>
								<th>RSVPs</th>
								<th>Stats</th>
								{userHasAccessToTeam || player ? (
									<th className={`bg-${team.color}-50 sticky right-0`}></th>
								) : null}
							</tr>
						</thead>
						<tbody>
							{nextGame ? (
								<>
									<tr>
										<th colSpan={5} className="text-left">
											Next Game
										</th>
										<td className={`bg-${team.color}-50 sticky right-0`}>
											<ShareNextGameButton
												slug={team.slug}
												teamName={team.name}
												nextGame={nextGame}
											/>
										</td>
									</tr>
									<GameRow
										game={nextGame}
										team={team}
										userHasAccessToTeam={userHasAccessToTeam}
										player={player}
										teamHasActiveSubscription={teamHasActiveSubscription}
									/>
								</>
							) : null}
							{pastGames.length > 0 ? (
								<>
									<tr>
										<th colSpan={6} className="text-left">
											Past Games
										</th>
									</tr>
									{pastGames.map((game) => (
										<GameRow
											key={game.id}
											game={game}
											team={team}
											userHasAccessToTeam={userHasAccessToTeam}
											player={player}
											teamHasActiveSubscription={teamHasActiveSubscription}
										/>
									))}
								</>
							) : null}
							{upcomingGames.length > 0 ? (
								<>
									<tr>
										<th colSpan={6} className="text-left">
											Upcoming Games
										</th>
									</tr>
									{upcomingGames.map((game) => (
										<GameRow
											key={game.id}
											game={game}
											team={team}
											userHasAccessToTeam={userHasAccessToTeam}
											player={player}
											teamHasActiveSubscription={teamHasActiveSubscription}
										/>
									))}
								</>
							) : null}
						</tbody>
					</table>
				</div>
			) : (
				<p>No games yet</p>
			)}
			{userHasAccessToTeam ? (
				<div className="space-y-1">
					<Dialog open={newGameModal} onOpenChange={setNewGameModal}>
						<DialogTrigger asChild>
							<Button
								className="w-full sm:w-auto"
								disabled={!teamHasActiveSubscription}
							>
								Add game
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Add game</DialogTitle>
							</DialogHeader>
							<GameForm
								closeModal={() => setNewGameModal(false)}
								teamId={team.id}
							/>
						</DialogContent>
					</Dialog>{' '}
					{userIsTylerOrMelissa ? (
						<Dialog
							open={importScheduleModal}
							onOpenChange={setImportScheduleModal}
						>
							<DialogTrigger asChild>
								<Button
									className="w-full sm:w-auto"
									disabled={!teamHasActiveSubscription}
								>
									Import schedule
								</Button>
							</DialogTrigger>
							<DialogContent className="max-h-dvh overflow-y-scroll">
								<DialogHeader>
									<DialogTitle>Import schedule</DialogTitle>
								</DialogHeader>
								<ImportScheduleForm
									closeModal={() => setImportScheduleModal(false)}
									teamId={team.id}
								/>
							</DialogContent>
						</Dialog>
					) : null}
				</div>
			) : null}
		</>
	)
}
