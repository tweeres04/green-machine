import { LoaderFunctionArgs } from '@remix-run/node'
import { json, useFetcher, useLoaderData } from '@remix-run/react'
import { format, parseISO } from 'date-fns'
import invariant from 'tiny-invariant'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import Nav from '~/components/ui/nav'
import { getDb } from '~/lib/getDb'
import { MoreHorizontal } from 'lucide-react'

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
} from '~/components/ui/dropdown-menu'

import { useEffect, useState } from 'react'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { teamHasActiveSubscription } from '~/lib/teamHasActiveSubscription'

type Season = Awaited<
	ReturnType<Awaited<ReturnType<typeof loader>>['json']>
>['team']['seasons'][0]

function SeasonForm({
	closeModal,
	season,
	teamId,
}: {
	closeModal: () => void
	season?: Season
	teamId?: number
}) {
	invariant(season || teamId, 'season or teamId is required')

	const fetcher = useFetcher()
	const saving = fetcher.state !== 'idle'

	useEffect(() => {
		if (fetcher.state === 'loading') {
			closeModal()
		}
	}, [closeModal, fetcher.state])

	return (
		<fetcher.Form
			action={season ? `/seasons/${season.id}` : '/seasons'}
			method={season ? 'put' : 'post'}
		>
			{season ? null : <input type="hidden" name="teamId" value={teamId} />}
			<fieldset className="space-y-3" disabled={saving}>
				<div>
					<label htmlFor="name_input">Name</label>
					<Input
						id="name_input"
						required
						name="name"
						defaultValue={season?.name}
					/>
				</div>
				<div>
					<label htmlFor="start_date_input">Start Date</label>
					<Input
						type="date"
						id="start_date_input"
						required
						name="startDate"
						defaultValue={season?.startDate ? season.startDate : ''}
					/>
				</div>
				<div>
					<label htmlFor="end_date_input">End Date</label>
					<Input
						type="date"
						id="end_date_input"
						required
						name="endDate"
						defaultValue={season?.endDate ? season.endDate : ''}
					/>
				</div>
				<DialogFooter>
					<Button type="submit" className="w-full">
						{season ? 'Update' : 'Add'}
					</Button>
				</DialogFooter>
			</fieldset>
		</fetcher.Form>
	)
}

function MoreButton({
	userHasAccessToTeam,
	season,
}: {
	userHasAccessToTeam: boolean
	season: Season
}) {
	const fetcher = useFetcher()
	const [editSeasonModal, setEditSeasonModal] = useState(false)
	const [removeSeasonModal, setRemoveSeasonModal] = useState(false)

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="icon" variant="secondary">
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{userHasAccessToTeam ? (
						<DropdownMenuItem
							onClick={() => {
								setEditSeasonModal(true)
							}}
						>
							Edit
						</DropdownMenuItem>
					) : null}
					{userHasAccessToTeam ? (
						<DropdownMenuItem
							onClick={() => {
								setRemoveSeasonModal(true)
							}}
						>
							Remove season
						</DropdownMenuItem>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={editSeasonModal} onOpenChange={setEditSeasonModal}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit season {season.name}</DialogTitle>
					</DialogHeader>
					<SeasonForm
						season={season}
						closeModal={() => setEditSeasonModal(false)}
					/>
				</DialogContent>
			</Dialog>

			<Dialog open={removeSeasonModal} onOpenChange={setRemoveSeasonModal}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Are you sure?</DialogTitle>
						<DialogDescription>This action cannot be undone.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="secondary" type="button">
								Cancel
							</Button>
						</DialogClose>
						<fetcher.Form
							method="delete"
							action={`/seasons/${season.id}/destroy`}
						>
							<Button variant="destructive" className="w-full sm:w-auto">
								Remove
							</Button>
						</fetcher.Form>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
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
			seasons: {
				orderBy: (seasons, { asc }) => asc(seasons.startDate),
			},
			subscription: true,
		},
	})

	const [user, team] = await Promise.all([userPromise, teamPromise])

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)
	const teamHasActiveSubscription_ = teamHasActiveSubscription(team)

	return json({
		team,
		userHasAccessToTeam,
		teamHasActiveSubscription: teamHasActiveSubscription_,
	})
}

export default function Seasons() {
	const { team, userHasAccessToTeam, teamHasActiveSubscription } =
		useLoaderData<typeof loader>()
	const [newSeasonModal, setNewSeasonModal] = useState(false)

	return (
		<>
			<Nav title="Seasons" team={team} />
			{team.seasons.length > 0 ? (
				<div className="w-full overflow-x-auto">
					<table className="w-full [&_td]:pt-2 [&_th:not(:last-child)]:pr-3 [&_td:not(:last-child)]:pr-3">
						<thead>
							<tr className="[&_th]:text-left">
								<th>Name</th>
								<th>Start Date</th>
								<th>End Date</th>
								{userHasAccessToTeam ? (
									<th className={`bg-${team.color}-50 sticky right-0`}></th>
								) : null}
							</tr>
						</thead>
						<tbody>
							{team.seasons.map((season) => (
								<tr key={season.id}>
									<td>{season.name}</td>
									<td>{format(parseISO(season.startDate), 'E MMM d')}</td>
									<td>{format(parseISO(season.endDate), 'E MMM d')}</td>
									{userHasAccessToTeam ? (
										<td className={`bg-${team.color}-50 sticky right-0`}>
											<MoreButton
												userHasAccessToTeam={userHasAccessToTeam}
												season={season}
											/>
										</td>
									) : null}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p>No seasons yet</p>
			)}
			{userHasAccessToTeam ? (
				<div className="space-y-1">
					<Dialog open={newSeasonModal} onOpenChange={setNewSeasonModal}>
						<DialogTrigger asChild>
							<Button
								className="w-full sm:w-auto"
								disabled={!teamHasActiveSubscription}
							>
								Add season
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Add season</DialogTitle>
							</DialogHeader>
							<SeasonForm
								closeModal={() => setNewSeasonModal(false)}
								teamId={team.id}
							/>
						</DialogContent>
					</Dialog>
				</div>
			) : null}
		</>
	)
}
