import { LoaderFunctionArgs } from '@remix-run/node'
import { json, useFetcher, useLoaderData } from '@remix-run/react'
import { format, formatISO } from 'date-fns'
import invariant from 'tiny-invariant'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import Nav from '~/components/ui/nav'
import { getDb } from '~/lib/getDb'

import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

import More from '~/components/ui/icons/more'
import { ReactNode, useEffect, useState } from 'react'
import { cn } from '~/lib/utils'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { DialogDescription } from '@radix-ui/react-dialog'

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
}: {
	closeModal: () => void
	game?: Game
}) {
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
								: new Date().toISOString()
						}}
					>
						{game.cancelledAt ? 'Uncancel' : 'Cancel'} game
					</Button>
				</fetcher.Form>
			</DialogFooter>
		</fieldset>
	)
}

function MoreButton({ game, player }: { game: Game; player?: Player }) {
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
						>
							RSVP
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem
						onClick={() => {
							setDialogTitle(`Edit game against ${game.opponent}`)
							setDialogContent(<GameForm game={game} closeModal={closeModal} />)
						}}
					>
						Edit
					</DropdownMenuItem>
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
						>
							{game.cancelledAt ? 'Uncancel' : 'Cancel'}
						</DropdownMenuItem>
					</fetcher.Form>
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

export async function loader({ params, request }: LoaderFunctionArgs) {
	const { teamSlug } = params
	invariant(teamSlug, 'Missing teamSlug parameter')

	const userPromise = authenticator.isAuthenticated(request)

	const db = getDb()

	const teamPromise = db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
		with: {
			games: {
				orderBy: (games, { asc }) => asc(games.timestamp),
				with: {
					rsvps: true,
				},
			},
			players: {
				with: {
					rsvps: true,
					userInvite: true,
				},
			},
		},
	})

	const [user, team] = await Promise.all([userPromise, teamPromise])

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)

	const player = team.players.find(
		(player) => player.userInvite?.userId === user?.id
	)

	return json({ team, userHasAccessToTeam, player })
}

export default function Games() {
	const { team, userHasAccessToTeam, player } = useLoaderData<typeof loader>()
	const [newGameModal, setNewGameModal] = useState(false)

	return (
		<>
			<Nav title="Games" team={team} />
			{team.games.length > 0 ? (
				<div className="w-full overflow-x-auto">
					<table className="w-full [&_td]:pt-2">
						<thead>
							<tr>
								<th className="text-left px-1">Date/time</th>
								<th className="text-left px-1">Opponent</th>
								<th className="text-left px-1">Location</th>
								<th>RSVPs</th>
								{userHasAccessToTeam ? (
									<th className={`bg-${team.color}-50 sticky right-0`}></th>
								) : null}
							</tr>
						</thead>
						<tbody>
							{team.games.map((game) => {
								const yeses = game.rsvps.filter((r) => r.rsvp === 'yes').length
								const nos = game.rsvps.filter((r) => r.rsvp === 'no').length
								return (
									<tr key={game.id}>
										<td className="relative">
											<div
												className={cn(game.cancelledAt ? 'line-through' : null)}
											>
												{game.timestamp
													? format(game.timestamp, "E MMM d 'at' h:mma")
													: 'TBD'}
											</div>
										</td>
										<td
											className={cn(game.cancelledAt ? 'line-through' : null)}
										>
											{game.opponent}
										</td>
										<td
											className={cn(game.cancelledAt ? 'line-through' : null)}
										>
											{game.location}
										</td>
										<td
											className={cn(
												'text-xs',
												game.cancelledAt ? 'line-through' : null
											)}
										>
											{yeses > 0 ? (
												<div className="font-bold">{yeses} yes</div>
											) : null}
											{nos > 0 ? <div>{nos} no</div> : null}
											<div>{team.players.length - game.rsvps.length} TBD</div>
										</td>
										{userHasAccessToTeam ? (
											<td className={`bg-${team.color}-50 sticky right-0`}>
												<MoreButton game={game} player={player} />
											</td>
										) : null}
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			) : (
				<p>No games yet</p>
			)}
			{userHasAccessToTeam ? (
				<Dialog open={newGameModal} onOpenChange={setNewGameModal}>
					<DialogTrigger asChild>
						<Button className="w-full sm:w-auto">Add game</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add game</DialogTitle>
						</DialogHeader>
						<GameForm closeModal={() => setNewGameModal(false)} />
					</DialogContent>
				</Dialog>
			) : null}
		</>
	)
}
