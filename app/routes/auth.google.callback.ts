import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { AuthorizationError } from 'remix-auth'

import { authenticateWithGoogle, authenticator } from '~/lib/auth.server'
import { getSession, commitSession } from '~/lib/session.server'
import {
	getSession as getShortSession,
	destroySession as destroyShortSession,
} from '~/lib/five-minute-session.server'

export async function loader({ request }: LoaderFunctionArgs) {
	let result
	try {
		result = await authenticateWithGoogle(request)
	} catch (error) {
		// Usually they backed out of the Google screen
		if (error instanceof AuthorizationError) {
			return redirect('/login')
		}
		throw error
	}

	const [session, shortSession] = await Promise.all([
		getSession(request.headers.get('Cookie')),
		getShortSession(request.headers.get('Cookie')),
	])

	session.set(authenticator.sessionKey, result.user)
	session.set(authenticator.sessionStrategyKey, 'google')

	// Same destinations the login and signup forms use
	const inviteId = session.get('inviteId')
	const inviteToken = session.get('inviteToken')
	const inviteRequestTeamId = session.get('inviteRequestTeamId')
	const destination =
		inviteId && inviteToken
			? `/invites/${inviteId}?token=${inviteToken}`
			: inviteRequestTeamId
			? `/request-invite?team_id=${inviteRequestTeamId}`
			: shortSession.get('googleRedirectTo') ?? '/'

	const headers = new Headers()
	headers.append('Set-Cookie', await commitSession(session))
	headers.append('Set-Cookie', await destroyShortSession(shortSession))

	return redirect(
		result.isNewUser
			? `/welcome?redirectTo=${encodeURIComponent(destination)}`
			: destination,
		{ headers }
	)
}
