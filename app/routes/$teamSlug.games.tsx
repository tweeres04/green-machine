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

export async function loader({ params }: LoaderFunctionArgs) {
	const { teamSlug } = params
	invariant(teamSlug, 'Missing teamSlug parameter')

	const db = getDb()

	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
		with: {
			games: {
				orderBy: (games, { asc }) => asc(games.timestamp),
			},
		},
	})

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	return json({ team })
}

export default function Games() {
	const { team } = useLoaderData<typeof loader>()
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
					<table className="w-full">
						<thead>
							<tr>
								<th className="text-left px-1">Date/time</th>
								<th className="text-left px-1">Opponent</th>
								<th className="text-left px-1">Location</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{team.games.map((game) => (
								<tr key={game.id}>
									<td className="relative">
										{game.timestamp
											? format(game.timestamp, "E MMM d 'at' h:mma")
											: 'TBD'}
									</td>
									<td>{game.opponent}</td>
									<td>{game.location}</td>
									<td className={`bg-${team.color}-50 sticky right-0`}>
										<MoreButton {...{ team, game }} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p>No games yet</p>
			)}
			<Dialog open={newGameModal} onOpenChange={setNewGameModal}>
				<DialogTrigger asChild>
					<Button className="w-full">Add game</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add game</DialogTitle>
					</DialogHeader>
					<GameForm team={team} closeModal={() => setNewGameModal(false)} />
				</DialogContent>
			</Dialog>
		</>
	)
}
