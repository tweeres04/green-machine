import { Form, useFetcher } from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { kebabCase } from 'lodash-es'
import React from 'react'
import Nav from '~/components/ui/nav'
import { useDebouncedCallback } from 'use-debounce'
import { LoaderFunctionArgs } from '@remix-run/node'
import { useDelayedLoading } from '~/lib/useDelayedLoading'
import { cn } from '~/lib/utils'
import { authenticator } from '~/lib/auth.server'

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
		fetcher.submit(
			{ slug: slugExample },
			{ method: 'get', action: '/check-slug' }
		)
		setNeedsCheck(false)
	}, 300)

	// First useEffect: Handle direct slug input changes
	React.useEffect(() => {
		if (!slugRef.current) return

		const slugInput = slugRef.current

		function handleSlugInput() {
			setEdited(true)
			setSlugExample(kebabCase(slugInput.value))
			setNeedsCheck(true)
			checkSlug()
		}

		slugInput.addEventListener('input', handleSlugInput)
		return () => slugInput.removeEventListener('input', handleSlugInput)
	}, [slugRef, checkSlug])

	// Second useEffect: Handle name-to-slug sync
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
		return () => nameInput?.removeEventListener('input', updateSlug)
	}, [checkSlug, edited, nameRef, slugRef])

	return {
		slugExample,
		needsCheck,
		slugIsAvailable: fetcher.data?.slugIsAvailable,
		isChecking: fetcher.state !== 'idle',
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	await authenticator.isAuthenticated(request, {
		failureRedirect: '/signup',
	})

	return null
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
			<div className="mb-6 space-y-2">
				<p className="text-lg font-medium">No credit card required</p>
				<p className="text-sm">
					Track stats for 3 games free. If you love it, subscribe for $19/year
					to unlock unlimited games.
				</p>
			</div>
			<Form action="/teams" method="post">
				<div className="space-y-4 mx-auto max-w-xs">
					<div>
						<label htmlFor="name">Team Name</label>
						<Input
							type="text"
							name="name"
							id="name"
							required
							ref={nameRef}
							className="!w-full"
						/>
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
								slugExample &&
									!needsCheck &&
									!isChecking &&
									slugIsAvailable === false &&
									'border-red-500 text-red-900 bg-red-50'
							)}
							style={{ width: '100%' }}
						/>
						<p className="text-sm">
							ex: teamstats.tweeres.com/
							<strong>{slugExample !== '' ? slugExample : 'my-slug'}</strong>
							{needsCheck || !slugExample ? null : showLoadingState ? (
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

					<Button type="submit" disabled={!slugIsAvailable}>
						Create Team
					</Button>
				</div>
			</Form>
		</>
	)
}
