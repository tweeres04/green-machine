import { Form } from '@remix-run/react'
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

function useAutoSlug(
	nameRef: React.RefObject<HTMLInputElement>,
	slugRef: React.RefObject<HTMLInputElement>
) {
	const [slugExample, setSlugExample] = React.useState('')
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
			setSlugExample(slug)
		}

		nameInput.addEventListener('input', updateSlug)

		return () => {
			nameInput?.removeEventListener('input', updateSlug)
		}
	}, [edited, nameRef, slugRef])

	return slugExample
}

export default function NewTeamForm() {
	const nameRef = React.useRef<HTMLInputElement>(null)
	const slugRef = React.useRef<HTMLInputElement>(null)
	const slugExample = useAutoSlug(nameRef, slugRef)

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
						<Input type="text" name="slug" id="slug" required ref={slugRef} />
						<p className="text-sm">
							ex: teamstats.tweeres.com/
							<strong>{slugExample !== '' ? slugExample : 'my-slug'}</strong>
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
