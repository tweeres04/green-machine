import { createCookieSessionStorage } from '@remix-run/node'

const { getSession, commitSession, destroySession } =
	createCookieSessionStorage({
		cookie: {
			name: 'five_minute_session',
			sameSite: 'lax',
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			maxAge: 300, // 5 minutes in seconds
		},
	})

export { getSession, commitSession, destroySession }
