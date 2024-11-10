import type {
	LoaderFunctionArgs,
	MetaArgs,
	MetaFunction,
} from '@remix-run/node'
import { useFetcher, useFetchers, useLoaderData } from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'

import { getDb } from '~/lib/getDb'
import { ReactNode, useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import invariant from 'tiny-invariant'
import { type Team } from '~/schema'
import Nav from '~/components/ui/nav'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import More from '~/components/ui/icons/more'

export const meta: MetaFunction = ({ data }: MetaArgs) => {
	const {
		team: { name, slug },
	} = data as { team: Team }

	const title = `Players - ${name} - TeamStats`
	const description = `Players - ${name}.`
	const url = `https://teamstats.tweeres.com/${slug}/players`

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

export async function loader({
	params: { teamSlug },
	request,
}: LoaderFunctionArgs) {
	const db = getDb()

	invariant(teamSlug, 'Missing teamSlug parameter')

	const [team, user] = await Promise.all([
		db.query.teams.findFirst({
			where: (teams, { eq }) => eq(teams.slug, teamSlug),
			with: {
				players: {
					with: {
						statEntries: true,
						userInvite: true,
					},
					orderBy: (players, { asc }) => [asc(players.name)],
				},
			},
		}),
		authenticator.isAuthenticated(request),
	])

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, team.id)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 401 })
	}

	return { team }
}

function useClearNewPlayerForm(
	formRef: React.MutableRefObject<HTMLFormElement | null>
) {
	const fetchers = useFetchers()
	const isAddingPlayer = fetchers.some(
		(fetcher) =>
			fetcher.state === 'submitting' &&
			/teams\/.+\/players/.test(fetcher.formAction) &&
			fetcher.formMethod === 'POST'
	)

	useEffect(() => {
		if (!isAddingPlayer) {
			formRef.current?.reset()
		}
	}, [formRef, isAddingPlayer])
}

export default function EditTeam() {
	const { team } = useLoaderData<typeof loader>()
	const { id, players } = team
	const formRef = useRef<HTMLFormElement>(null)
	const fetcher = useFetcher()

	const [{ title, description, body }, setMenuDialogState] = useState<{
		title: string | null
		description: string | null
		body: ReactNode | null
	}>({
		title: null,
		description: null,
		body: null,
	})

	const saving = fetcher.state !== 'idle'

	useEffect(() => {
		if (fetcher.state === 'loading') {
			setMenuDialogState({
				title: null,
				description: null,
				body: null,
			})
		}
	}, [fetcher.state])

	const menuDialogIsOpen = Boolean(title && body)

	useClearNewPlayerForm(formRef)

	return (
		<>
			<Nav title="Players" team={team} />
			<ul className="space-y-2">
				{players.map((p) => {
					const goalCount = p.statEntries.filter(
						(s) => s.type === 'goal'
					).length
					const assistCount = p.statEntries.filter(
						(s) => s.type === 'assist'
					).length
					return (
						<li className="flex items-center gap-3" key={p.id}>
							<Avatar>
								<AvatarFallback>{p.name[0]}</AvatarFallback>
							</Avatar>
							<span className="grow">{p.name}</span>
							<span className="text-2xl">
								{p.statEntries.length === 0
									? '-'
									: `${goalCount}G ${assistCount}A`}
							</span>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button size="icon" variant="secondary">
										<More />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									{p.userInvite ? (
										<DropdownMenuItem disabled>
											{p.userInvite.acceptedAt ? (
												<>Invite accepted</>
											) : (
												<>Invite sent</>
											)}
										</DropdownMenuItem>
									) : (
										<DropdownMenuItem
											onClick={() => {
												setMenuDialogState(() => ({
													title: `Send invite to ${p.name}`,
													description: null,
													body: (
														<fetcher.Form
															method="post"
															action={`/players/${p.id}/invite`}
														>
															<fieldset disabled={saving} className="space-y-3">
																<div>
																	<label htmlFor="email_input">Email</label>
																	<Input
																		id="email_input"
																		required
																		name="email"
																	/>
																</div>
																<DialogFooter>
																	<DialogClose asChild>
																		<Button variant="secondary" type="button">
																			Cancel
																		</Button>
																	</DialogClose>
																	<Button type="submit">Send</Button>
																</DialogFooter>
															</fieldset>
														</fetcher.Form>
													),
												}))
											}}
										>
											Send invite
										</DropdownMenuItem>
									)}
									<DropdownMenuItem
										onClick={() => {
											setMenuDialogState(() => ({
												title: 'Are you sure?',
												description: 'This action cannot be undone.',
												body: (
													<DialogFooter>
														<DialogClose asChild>
															<Button variant="secondary" type="button">
																Cancel
															</Button>
														</DialogClose>
														<fetcher.Form
															method="delete"
															action={`/players/${p.id}/destroy`}
														>
															<Button
																variant="destructive"
																className="w-full sm:w-auto"
															>
																Remove
															</Button>
														</fetcher.Form>
													</DialogFooter>
												),
											}))
										}}
									>
										Remove player
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					)
				})}
			</ul>
			<Dialog
				open={menuDialogIsOpen}
				onOpenChange={(value) => {
					if (!value) {
						setMenuDialogState({
							title: null,
							description: null,
							body: null,
						})
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						{description ? (
							<DialogDescription>{description}</DialogDescription>
						) : null}
					</DialogHeader>
					{body}
				</DialogContent>
			</Dialog>
			<Dialog>
				<DialogTrigger asChild>
					<Button className="w-full sm:w-auto">Add player</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add player</DialogTitle>
					</DialogHeader>
					<fetcher.Form
						method="post"
						action={`/teams/${id}/players`}
						className="space-y-3"
						ref={formRef}
					>
						<div className="space-y-3">
							<div>
								<label htmlFor="name_input">Name</label>
								<Input name="name" id="name_input" />
							</div>
							<div>
								<label htmlFor="name_input">Email</label>
								<Input name="email" id="email_input" />
							</div>
						</div>
						<DialogFooter className="flex-col sm:flex-row">
							<DialogClose>
								<Button variant="secondary" type="button">
									Cancel
								</Button>
							</DialogClose>
							<Button type="submit">Save</Button>
						</DialogFooter>
					</fetcher.Form>
				</DialogContent>
			</Dialog>
		</>
	)
}
