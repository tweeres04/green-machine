import type { ActionFunctionArgs } from '@remix-run/node'

import { authenticateWithGoogle } from '~/lib/auth.server'
import { safeRedirect } from '~/lib/redirect-to.server'
import {
	getSession as getShortSession,
	commitSession as commitShortSession,
} from '~/lib/five-minute-session.server'

export async function action({ request }: ActionFunctionArgs) {
	const [formData, shortSession] = await Promise.all([
		request.formData(),
		getShortSession(request.headers.get('Cookie')),
	])

	// The strategy owns the main session cookie on the way to Google, so
	// redirectTo rides along in its own cookie until the callback
	const redirectTo = safeRedirect(formData.get('redirectTo'))
	if (redirectTo) {
		shortSession.set('googleRedirectTo', redirectTo)
	}

	try {
		await authenticateWithGoogle(request)
	} catch (response) {
		if (response instanceof Response) {
			response.headers.append(
				'Set-Cookie',
				await commitShortSession(shortSession)
			)
		}
		throw response
	}

	throw new Error('Expected a redirect to Google')
}
