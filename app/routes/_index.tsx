import type { MetaFunction } from '@remix-run/node'
import { Form } from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { kebabCase } from 'lodash-es'
import React from 'react'

export const meta: MetaFunction = () => {
	return [
		{ title: 'TeamStats' },
		{
			name: 'description',
			content: 'Set up stats for your sports team',
		},
		{ name: 'robots', context: 'noindex' },
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

export default function Index() {
	const nameRef = React.useRef<HTMLInputElement>(null)
	const slugRef = React.useRef<HTMLInputElement>(null)
	useAutoSlug(nameRef, slugRef)

	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<h1 className="text-3xl">New team</h1>

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
