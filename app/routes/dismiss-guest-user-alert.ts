import { ActionFunction } from '@remix-run/node'
import { getSession, commitSession } from '~/lib/five-minute-session.server'

export const action: ActionFunction = async ({ request }) => {
	const session = await getSession(request.headers.get('Cookie'))
	session.set('guestUserAlertDismissed', 'true')
	return new Response(null, {
		headers: {
			'Set-Cookie': await commitSession(session),
		},
	})
}
