import { Authenticator } from 'remix-auth'
import { sessionStorage } from '~/lib/session.server'
import { FormStrategy } from 'remix-auth-form'
import { GoogleStrategy } from 'remix-auth-google'
import argon2 from 'argon2'
import { getDb } from './getDb'
import { User, users } from '~/schema'
import invariant from 'tiny-invariant'
import { mixpanelServer } from './mixpanel.server'
import { sendCapiEvent } from './facebook.server'
import { LibsqlError } from '@libsql/client'
import { captureException } from '@sentry/remix'
import { sendWelcomeEmail } from './welcome-email.server'
import { notifyOwner } from './owner-notification.server'
import { isElevatedFor } from './support.server'

export async function hasAccessToTeam(user: User | null, teamId: number) {
	if (!user) {
		return false
	}

	// Support access is opt in and expires. Without a live elevation for this
	// team, a support user is treated like anyone else
	if (isElevatedFor(user, teamId)) {
		return true
	}

	const db = getDb()

	const teamUser = await db.query.teamsUsers.findFirst({
		where: (teamsUsers, { and, eq }) =>
			and(eq(teamsUsers.teamId, teamId), eq(teamsUsers.userId, user.id)),
	})

	return Boolean(teamUser)
}

async function signUp(
	name: FormDataEntryValue | null,
	email: string,
	password: string,
	repeatPassword: FormDataEntryValue | null,
	request: Request
) {
	if (!name || typeof name !== 'string') {
		throw new Error('Name is required')
	}

	if (!repeatPassword || typeof repeatPassword !== 'string') {
		throw new Error('You must repeat your password')
	}

	if (password !== repeatPassword) {
		throw new Error('Passwords do not match')
	}

	const hashedPassword = await argon2.hash(password)

	const db = getDb()
	let newUsers
	try {
		newUsers = await db
			.insert(users)
			.values({
				name,
				email,
				password: hashedPassword,
			})
			.returning()
	} catch (error) {
		if (
			error instanceof LibsqlError &&
			error.code === 'SQLITE_CONSTRAINT_UNIQUE'
		) {
			throw new Error('Email already taken')
		}
		throw error
	}

	const newUser = newUsers[0]

	announceSignUp(newUser, 'password', request)

	return newUser
}

function announceSignUp(
	newUser: User,
	method: 'password' | 'google',
	request: Request
) {
	mixpanelServer.track('sign up', {
		distinct_id: newUser.id,
		method,
	})

	sendWelcomeEmail(newUser).catch(captureException)

	notifyOwner({
		subject: `New signup: ${newUser.name}`,
		text: `${newUser.name} (${newUser.email}) just signed up.`,
	}).catch(captureException)

	sendCapiEvent({
		request,
		eventName: 'CompleteRegistration',
		user: newUser,
	}).catch(console.error)
}

async function login(email: string, password: string) {
	const db = getDb()
	const user = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.email, email),
	})

	if (!user) {
		throw new Error('Invalid email or password')
	}

	if (!user.password) {
		throw new Error(
			'This account uses Google to sign in. Tap Continue with Google instead.'
		)
	}

	const validPassword = await argon2.verify(user.password, password)

	if (!validPassword) {
		throw new Error('Invalid email or password')
	}

	return {
		id: user.id,
		email: user.email,
		name: user.name,
		stripeCustomerId: user.stripeCustomerId,
	}
}

// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session
export const authenticator = new Authenticator<User>(sessionStorage)

// Tell the Authenticator to use the form strategy
authenticator.use(
	new FormStrategy(async ({ form, request }) => {
		const name = form.get('name')
		const email = form.get('email')
		const password = form.get('password')
		const repeatPassword = form.get('repeat_password')

		if (!email || typeof email !== 'string') {
			throw new Error('Email is required')
		}
		if (!password || typeof password !== 'string') {
			throw new Error('A password is required')
		}

		// Emails are stored and compared lowercase so logins are
		// case-insensitive (mobile keyboards love to capitalize them)
		const normalizedEmail = email.trim().toLowerCase()

		const path = new URL(request.url).pathname
		if (path !== '/login' && path !== '/signup') {
			throw new Error('Not found')
		}
		const user =
			path === '/login'
				? await login(normalizedEmail, password)
				: path === '/signup'
				? await signUp(name, normalizedEmail, password, repeatPassword, request)
				: null

		invariant(user, 'Path should be /login or /signup')

		// the type of this user must match the type you pass to the Authenticator
		// the strategy will automatically inherit the type if you instantiate
		// directly inside the `use` method
		return user
	}),
	// each strategy has a name and can be changed to use another one
	// same strategy multiple times, especially useful for the OAuth2 strategy.
	'user-pass'
)

invariant(process.env.GOOGLE_CLIENT_ID, 'No GOOGLE_CLIENT_ID')
invariant(process.env.GOOGLE_CLIENT_SECRET, 'No GOOGLE_CLIENT_SECRET')
invariant(process.env.BASE_URL, 'No BASE_URL')

// Used through authenticateWithGoogle rather than registered on the
// authenticator, so the callback can tell new users (who detour through
// /welcome) apart from returning ones
const googleStrategy = new GoogleStrategy<{
	user: User
	isNewUser: boolean
}>(
	{
		clientID: process.env.GOOGLE_CLIENT_ID,
		clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
		prompt: 'select_account',
	},
	async ({ profile, request }) => {
		// Google has confirmed they own this address, so it's safe to sign them
		// into an existing password account with the same email
		if (!profile._json.email_verified) {
			throw new Error('Your Google email address is not verified')
		}

		const email = profile._json.email.toLowerCase()
		const db = getDb()

		const existingUser = await db.query.users.findFirst({
			columns: { password: false },
			where: (users, { eq }) => eq(users.email, email),
		})

		if (existingUser) {
			return { user: existingUser, isNewUser: false }
		}

		const [newUser] = await db
			.insert(users)
			.values({ name: profile.displayName, email })
			.returning({
				id: users.id,
				email: users.email,
				name: users.name,
				stripeCustomerId: users.stripeCustomerId,
			})

		announceSignUp(newUser, 'google', request)

		return { user: newUser, isNewUser: true }
	}
)

export function authenticateWithGoogle(request: Request) {
	return googleStrategy.authenticate(request, sessionStorage, {
		name: 'google',
		sessionKey: authenticator.sessionKey,
		sessionErrorKey: authenticator.sessionErrorKey,
		sessionStrategyKey: authenticator.sessionStrategyKey,
		throwOnError: true,
	})
}
