import { LoaderFunctionArgs } from '@remix-run/node'
import {
	Form,
	json,
	useFetcher,
	useLoaderData,
	useParams,
} from '@remix-run/react'
import { formatISO } from 'date-fns'
import invariant from 'tiny-invariant'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { getDb } from '~/lib/getDb'

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
	const { teamSlug } = useParams()
	const { team } = useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const datepickerTimestampString = formatISO(new Date()).slice(0, 16) // Chop off offset
	return (
		<>
			<h1 className="text-2xl">Games</h1>
			{team.games.map((game) => (
				<fetcher.Form
					key={game.id}
					id={`game_form_${game.id}`}
					action={`/games/${game.id}`}
					method="put"
				/>
			))}
			{team.games.length > 0 ? (
				<table className="w-full">
					<thead>
						<tr>
							<th className="text-left">Date and time</th>
							<th className="text-left">Opponent</th>
							<th className="text-left">Location</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{team.games.map((game) => {
							const formId = `game_form_${game.id}`
							const datepickerTimestampString = formatISO(game.timestamp).slice(
								0,
								19
							) // Chop off offset
							const saving =
								fetcher.formAction === `/games/${game.id}` &&
								(fetcher.state === 'submitting' || fetcher.state === 'loading')
							return (
								<tr key={game.id}>
									<td className="relative">
										<Input
											type="datetime-local"
											id={`timestamp_input_${game.id}`}
											defaultValue={datepickerTimestampString}
											step="60"
											onChange={(e) => {
												const timestampInput =
													e.target.parentElement?.querySelector<HTMLInputElement>(
														'#hidden_timestamp_input' // I should use a ref at some point
													)
												invariant(timestampInput, 'timestampInput not found')
												timestampInput.value = formatISO(e.target.value)
											}}
											variant="transparent"
										/>
										<input
											type="hidden"
											name="timestamp"
											id="hidden_timestamp_input"
											form={formId}
											defaultValue={game.timestamp}
										/>
									</td>
									<td>
										<Input
											name="opponent"
											defaultValue={game.opponent}
											form={formId}
											variant="transparent"
										/>
									</td>
									<td>
										<Input
											name="location"
											defaultValue={game.location}
											form={formId}
											variant="transparent"
										/>
									</td>
									<td>
										<Button
											type="submit"
											size="sm"
											variant="secondary"
											form={formId}
											disabled={saving}
										>
											Save
										</Button>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			) : (
				<p>No games yet</p>
			)}
			<h2 className="text-xl">New game</h2>
			<Form className="space-y-3" action="/games" method="post">
				<input type="hidden" name="team_slug" value={teamSlug} />
				<input type="hidden" name="team_id" value={team.id} />
				<div>
					<label htmlFor="timestamp_input">Date and time</label>
					<Input
						type="datetime-local"
						step="60"
						id="timestamp_input"
						value={datepickerTimestampString}
						required
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
					<Input id="opponent_input" name="opponent" />
				</div>
				<div>
					<label htmlFor="location_input">Location</label>
					<Input id="location_input" name="location" />
				</div>
				<Button type="submit" className="w-full sm:w-auto">
					Add game
				</Button>
			</Form>
		</>
	)
}
