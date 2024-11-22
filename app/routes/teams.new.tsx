import { Form, useFetcher } from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { kebabCase } from 'lodash-es'
import React from 'react'
import Nav from '~/components/ui/nav'
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardFooter,
} from '~/components/ui/card'
import invariant from 'tiny-invariant'
import { useDebouncedCallback } from 'use-debounce'
import { LoaderFunctionArgs, json } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { useDelayedLoading } from '~/lib/useDelayedLoading'
import { cn } from '~/lib/utils'

interface SlugCheckResponse {
	slugIsAvailable: boolean
}

function useAutoSlug(
	nameRef: React.RefObject<HTMLInputElement>,
	slugRef: React.RefObject<HTMLInputElement>
) {
	const [slugExample, setSlugExample] = React.useState('')
	const [edited, setEdited] = React.useState(false)
	const fetcher = useFetcher<SlugCheckResponse>()
	const [needsCheck, setNeedsCheck] = React.useState(false)
	const checkSlug = useDebouncedCallback(() => {
		fetcher.submit({ slug: slugExample }, { method: 'get' })
		setNeedsCheck(false)
	}, 300)

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
			setSlugExample(slug)
			setNeedsCheck(true)
			checkSlug()
		}

		nameInput.addEventListener('input', updateSlug)

		return () => {
			nameInput?.removeEventListener('input', updateSlug)
		}
	}, [checkSlug, edited, nameRef, slugRef])

	return {
		slugExample,
		needsCheck,
		slugIsAvailable: fetcher.data?.slugIsAvailable,
		isChecking: fetcher.state !== 'idle',
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const slug = url.searchParams.get('slug')

	if (!slug) return json({ slugIsAvailable: false })

	const db = getDb()
	const existingTeam = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, slug),
	})

	return json({ slugIsAvailable: !existingTeam })
}

export default function NewTeamForm() {
	const nameRef = React.useRef<HTMLInputElement>(null)
	const slugRef = React.useRef<HTMLInputElement>(null)
	const { slugExample, needsCheck, slugIsAvailable, isChecking } = useAutoSlug(
		nameRef,
		slugRef
	)
	const showLoadingState = useDelayedLoading(isChecking)

	return (
		<>
			<Nav title="Create team" />
			<Form action="/teams" method="post">
				<input type="hidden" name="plan" id="plan_input" />
				<div className="space-y-4">
					<div>
						<label htmlFor="name">Team Name</label>
						<Input type="text" name="name" id="name" required ref={nameRef} />
					</div>
					<div>
						<label htmlFor="slug">Slug</label>
						<Input
							type="text"
							name="slug"
							id="slug"
							required
							ref={slugRef}
							aria-invalid={slugIsAvailable === false}
							className={cn(
								!needsCheck &&
									!isChecking &&
									slugIsAvailable === false &&
									'border-red-500 text-red-900 bg-red-50'
							)}
						/>
						<p className="text-sm">
							ex: teamstats.tweeres.com/
							<strong>{slugExample !== '' ? slugExample : 'my-slug'}</strong>
							{needsCheck ? null : showLoadingState ? (
								<span className="ml-2 text-gray-500">
									Checking availability...
								</span>
							) : slugIsAvailable === false ? (
								<span className="ml-2 text-red-900">Slug already taken</span>
							) : slugIsAvailable ? (
								<span className="ml-2 text-green-500">Slug available</span>
							) : null}
						</p>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>$49 USD/yr</CardTitle>
						</CardHeader>
						<CardContent className="text-xs">
							<p className="mb-3">Includes everything your team needs:</p>
							<ul className="list-disc pl-5">
								<li>Team stats timeline for goals and assists</li>
								<li>Goal and assist streaks</li>
								<li>Game RSVPs</li>
								<li>Team logo</li>
								<li>Player pictures</li>
							</ul>
						</CardContent>
						<CardFooter>
							<Button
								type="submit"
								onClick={() => {
									const planInput = document.getElementById('plan_input')
									invariant(
										planInput instanceof HTMLInputElement,
										'plan input not found'
									)
									planInput.value = 'yearly'
								}}
								disabled={!slugIsAvailable}
							>
								Create Team
							</Button>
						</CardFooter>
					</Card>
				</div>
			</Form>
		</>
	)
}
