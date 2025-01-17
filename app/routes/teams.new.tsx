import { Form, useFetcher, useLoaderData } from '@remix-run/react'
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
import { json } from '@remix-run/node'
import { useDelayedLoading } from '~/lib/useDelayedLoading'
import { cn } from '~/lib/utils'
import Stripe from 'stripe'

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

export async function loader() {
	invariant(process.env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY must be set')
	invariant(
		process.env.STRIPE_YEARLY_PRICE_ID,
		'STRIPE_YEARLY_PRICE_ID must be set'
	)

	const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
		apiVersion: '2024-10-28.acacia',
	})
	const priceData = await stripe.prices.retrieve(
		process.env.STRIPE_YEARLY_PRICE_ID
	)

	invariant(priceData.unit_amount, 'Price data not found')

	const price = priceData.unit_amount / 100 // Convert to dollars

	return json({ price })
}

export default function NewTeamForm() {
	const { price } = useLoaderData<typeof loader>()
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
								slugExample &&
									!needsCheck &&
									!isChecking &&
									slugIsAvailable === false &&
									'border-red-500 text-red-900 bg-red-50'
							)}
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

					<Card>
						<CardHeader>
							<CardTitle>${price} USD/yr</CardTitle>
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
