import { useState } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useSearchParams } from '@remix-run/react'
import { captureException } from '@sentry/remix'

import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { authenticator } from '~/lib/auth.server'
import { mixpanelServer } from '~/lib/mixpanel.server'
import { notifyOwner } from '~/lib/owner-notification.server'
import { safeRedirect } from '~/lib/redirect-to.server'

const options: {
	value: string
	label: string
	detail?: { label: string; placeholder?: string }
}[] = [
	{ value: 'friend or teammate', label: 'A friend or teammate' },
	{
		value: 'chatgpt or other ai',
		label: 'ChatGPT or another AI',
		// No placeholder: don't seed what they "should" have asked
		detail: { label: 'What did you ask it?' },
	},
	{ value: 'google', label: 'Google' },
	{ value: 'reddit', label: 'Reddit' },
	{
		value: 'somewhere else',
		label: 'Somewhere else',
		detail: {
			label: 'Where?',
			placeholder: 'e.g. a Facebook group',
		},
	},
]

export default function Welcome() {
	const [searchParams] = useSearchParams()
	const redirectTo = searchParams.get('redirectTo')
	const [selected, setSelected] = useState<(typeof options)[number] | null>(
		null
	)

	return (
		<Form method="post" className="space-y-3">
			{redirectTo ? (
				<input type="hidden" name="redirectTo" value={redirectTo} />
			) : null}
			<h1 className="text-2xl">One quick question</h1>
			<p>How did you hear about TeamStats?</p>
			{selected ? (
				<>
					<input type="hidden" name="answer" value={selected.value} />
					<div>
						<label htmlFor="detail_input">{selected.detail?.label}</label>
						<Textarea
							name="detail"
							id="detail_input"
							placeholder={selected.detail?.placeholder}
						/>
					</div>
					<Button type="submit">Continue</Button>
				</>
			) : (
				<div className="flex flex-col gap-2 items-start">
					{options.map((o) =>
						o.detail ? (
							<Button
								key={o.value}
								type="button"
								variant="outline"
								onClick={() => setSelected(o)}
							>
								{o.label}
							</Button>
						) : (
							<Button
								key={o.value}
								type="submit"
								variant="outline"
								name="answer"
								value={o.value}
							>
								{o.label}
							</Button>
						)
					)}
				</div>
			)}
			<p>
				<Button
					type="submit"
					variant="ghost"
					name="answer"
					value=""
					className="w-full"
				>
					Skip
				</Button>
			</p>
		</Form>
	)
}

export async function action({ request }: ActionFunctionArgs) {
	const user = await authenticator.isAuthenticated(request, {
		failureRedirect: '/login',
	})

	const formData = await request.formData()
	const answer = formData.get('answer')
	const detail = formData.get('detail')
	const redirectTo = safeRedirect(formData.get('redirectTo'))

	if (typeof answer === 'string' && answer !== '') {
		mixpanelServer.track('how did you hear about us', {
			distinct_id: user.id,
			answer,
			...(typeof detail === 'string' && detail !== '' ? { detail } : {}),
		})

		notifyOwner({
			subject: `${user.name} heard about us via ${answer}`,
			text: detail ? `They said: ${detail}` : '',
		}).catch(captureException)
	}

	return redirect(redirectTo ?? '/')
}

export async function loader({ request }: LoaderFunctionArgs) {
	await authenticator.isAuthenticated(request, {
		failureRedirect: '/login',
	})

	return null
}
