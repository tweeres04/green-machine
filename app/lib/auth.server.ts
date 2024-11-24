import { Authenticator } from 'remix-auth'
import { sessionStorage } from '~/lib/session.server'
import { FormStrategy } from 'remix-auth-form'
import argon2 from 'argon2'
import { getDb } from './getDb'
import { User, users } from '~/schema'
import invariant from 'tiny-invariant'
import { mixpanelServer } from './mixpanel.server'
import { SqliteError } from 'better-sqlite3'

export async function hasAccessToTeam(user: User | null, teamId: number) {
	if (!user) {
		return false
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
	repeatPassword: FormDataEntryValue | null
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
			error instanceof SqliteError &&
			error.code === 'SQLITE_CONSTRAINT_UNIQUE'
		) {
			throw new Error('Email already taken')
		}
		throw error
	}

	const newUser = newUsers[0]

	mixpanelServer.track('sign up', {
		distinct_id: newUser.id,
	})

	return newUser
}

async function login(email: string, password: string) {
	const db = getDb()
	const user = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.email, email),
	})

	if (!user) {
		throw new Error('Invalid email or password')
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

		const path = new URL(request.url).pathname
		if (path !== '/login' && path !== '/signup') {
			throw new Error('Not found')
		}
		const user =
			path === '/login'
				? await login(email, password)
				: path === '/signup'
				? await signUp(name, email, password, repeatPassword)
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
