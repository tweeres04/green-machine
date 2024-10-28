import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { Form, json, useLoaderData } from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { kebabCase } from 'lodash-es'
import React from 'react'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import Nav from '~/components/ui/nav'

export const meta: MetaFunction = () => {
	return [
		{ title: 'TeamStats' },
		{
			name: 'description',
			content: 'Set up stats for your sports team',
		},
		{ name: 'robots', context: 'noindex' },
		{ taname: 'link', rel: 'canonical', href: 'https://teamstats.tweeres.com' },
	]
}

function useAutoSlug(
	nameRef: React.RefObject<HTMLInputElement>,
	slugRef: React.RefObject<HTMLInputElement>
) {
	const [edited, setEdited] = React.useState(false)

	React.useEffect(() => {
		if (!slugRef.current) return

		slugRef.current.addEventListener('input', () => {
			setEdited(true)
		})
	}, [slugRef])

	React.useEffect(() => {
		if (!slugRef.current || !nameRef.current) return

		const nameInput = nameRef.current
		const slugInput = slugRef.current

		function updateSlug() {
			if (edited) return

			const slug = kebabCase(nameInput.value)
			slugInput.value = slug
		}

		nameInput.addEventListener('input', updateSlug)

		return () => {
			nameInput?.removeEventListener('input', updateSlug)
		}
	}, [edited, nameRef, slugRef])
}

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await authenticator.isAuthenticated(request, {
		failureRedirect: '/login',
	})

	const db = getDb()

	const teamsUsers = await db.query.teamsUsers.findMany({
		where: (teamsUsers, { eq }) => eq(teamsUsers.userId, user.id),
		with: {
			team: {
				with: {
					players: {
						with: {
							statEntries: true,
						},
					},
				},
			},
		},
	})

	const teams = teamsUsers
		.map((tu) => tu.team)
		.toSorted((a, b) => a.name.localeCompare(b.name))

	return json({ teams })
}

export default function Index() {
	const { teams } = useLoaderData<typeof loader>()
	const nameRef = React.useRef<HTMLInputElement>(null)
	const slugRef = React.useRef<HTMLInputElement>(null)
	useAutoSlug(nameRef, slugRef)

	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<Nav title="My Teams" />
			{teams.length > 0 ? (
				<ul className="space-y-3">
					{teams.map((t) => {
						const playerCount = t.players.length
						const statCount = t.players.reduce(
							(acc, p) => acc + p.statEntries.length,
							0
						)
						return (
							<li key={t.id}>
								<Button asChild variant="link" className="pl-0">
									<a href={`/${t.slug}`} className="text-xl">
										{t.name}
									</a>
								</Button>
								<p>
									{playerCount} player{playerCount !== 1 && 's'}, {statCount}{' '}
									stat{statCount !== 1 && 's'} recorded
								</p>
							</li>
						)
					})}
				</ul>
			) : (
				<p>No teams yet. Create one to get started.</p>
			)}

			<h2 className="text-3xl">New team</h2>

			<Form method="post" action="/teams">
				<div className="space-y-4">
					<div>
						<label htmlFor="name">Team Name</label>
						<Input type="text" name="name" id="name" required ref={nameRef} />
					</div>

					<div>
						<label htmlFor="slug">Slug</label>
						<Input type="text" name="slug" id="slug" required ref={slugRef} />
						<p className="text-sm">
							ex: teamstats.tweeres.com/<strong>my-slug</strong>
						</p>
					</div>

					<div className="space-x-2">
						<Button type="button" variant="secondary">
							Cancel
						</Button>
						<Button type="submit">Create Team</Button>
					</div>
				</div>
			</Form>
		</div>
	)
}
