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
import { Game, Team } from '~/schema'
import { useEffect, useState } from 'react'
import { cn } from '~/lib/utils'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'

function GameForm({
	closeModal,
	team,
	game,
}: {
	team: Team
	closeModal?: () => void
	game?: Game
}) {
	const fetcher = useFetcher()
	const datepickerTimestampString = (
		game?.timestamp ?? formatISO(new Date())
	).slice(0, 16) // Chop off offset
	const saving = fetcher.state !== 'idle'

	useEffect(() => {
		if (closeModal && fetcher.state === 'loading') {
			closeModal()
		}
	}, [closeModal, fetcher.state])

	return (
		<fetcher.Form
			action={game ? `/games/${game.id}` : '/games'}
			method={game ? 'put' : 'post'}
		>
			<fieldset className="space-y-3" disabled={saving}>
				<input type="hidden" name="team_slug" value={team.slug} />
				<input type="hidden" name="team_id" value={team.id} />
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
						defaultValue={game?.location}
					/>
				</div>
				<Button type="submit" className="w-full">
					{game ? 'Update' : 'Add'}
				</Button>
			</fieldset>
		</fetcher.Form>
	)
}

function MoreButton({ team, game }: { team: Team; game: Game }) {
	const [dialogOpen, setDialogOpen] = useState(false)
	const fetcher = useFetcher()

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="icon" variant="secondary">
						<More />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DialogTrigger asChild>
						<DropdownMenuItem>Edit</DropdownMenuItem>
					</DialogTrigger>
					<fetcher.Form>
						<DropdownMenuItem
							onClick={() => {
								fetcher.submit(
									{
										cancelledAt: game?.cancelledAt
											? null
											: new Date().toISOString(),
									},
									{
										action: `/games/${game.id}`,
										method: 'patch',
									}
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
					<DialogTitle>Edit game</DialogTitle>
				</DialogHeader>
				<GameForm
					team={team}
					game={game}
					closeModal={() => {
						setDialogOpen(false)
					}}
				/>
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
			},
		},
	})

	const [user, team] = await Promise.all([userPromise, teamPromise])

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)

	return json({ team, userHasAccessToTeam })
}

export default function Games() {
	const { team, userHasAccessToTeam } = useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const [newGameModal, setNewGameModal] = useState(false)

	return (
		<>
			<Nav title="Games" team={team} />
			{team.games.map((game) => (
				<fetcher.Form
					key={game.id}
					id={`game_form_${game.id}`}
					action={`/games/${game.id}`}
					method="put"
				/>
			))}
			{team.games.length > 0 ? (
				<div className="w-full overflow-x-auto">
					<table className="w-full [&_td]:pt-2">
						<thead>
							<tr>
								<th className="text-left px-1">Date/time</th>
								<th className="text-left px-1">Opponent</th>
								<th className="text-left px-1">Location</th>
								{userHasAccessToTeam ? <th></th> : null}
							</tr>
						</thead>
						<tbody>
							{team.games.map((game) => (
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
									<td className={cn(game.cancelledAt ? 'line-through' : null)}>
										{game.opponent}
									</td>
									<td className={cn(game.cancelledAt ? 'line-through' : null)}>
										{game.location}
									</td>
									{userHasAccessToTeam ? (
										<td className={`bg-${team.color}-50 sticky right-0`}>
											<MoreButton {...{ team, game }} />
										</td>
									) : null}
								</tr>
							))}
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
						<GameForm team={team} closeModal={() => setNewGameModal(false)} />
					</DialogContent>
				</Dialog>
			) : null}
		</>
	)
}
