import { Authenticator } from 'remix-auth'
import { sessionStorage } from '~/lib/session.server'
import { FormStrategy } from 'remix-auth-form'
import argon2 from 'argon2'
import { getDb } from './getDb'
import { User, users } from '~/schema'
import invariant from 'tiny-invariant'

async function signUp(
	name: FormDataEntryValue | null,
	email: string,
	password: string,
	repeatPassword: FormDataEntryValue | null
) {
	if (!name || typeof name !== 'string') {
		throw new Response('Name is required', { status: 400 })
	}

	if (!repeatPassword || typeof repeatPassword !== 'string') {
		throw new Response('You must repeat your password', { status: 400 })
	}

	if (password !== repeatPassword) {
		throw new Response('Passwords do not match', { status: 400 })
	}

	const hashedPassword = await argon2.hash(password)

	const db = getDb()
	const newUsers = await db
		.insert(users)
		.values({
			name,
			email,
			password: hashedPassword,
		})
		.returning()

	return newUsers[0]
}

async function login(email: string, password: string) {
	const db = getDb()
	const user = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.email, email),
	})

	if (!user) {
		throw new Response('Invalid email or password', { status: 401 })
	}

	const validPassword = await argon2.verify(user.password, password)

	if (!validPassword) {
		throw new Response('Invalid email or password', { status: 401 })
	}

	return {
		id: user.id,
		email: user.email,
		name: user.name,
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
			throw new Response('Email is required', { status: 400 })
		}
		if (!password || typeof password !== 'string') {
			throw new Response('A password is required', { status: 400 })
		}

		const path = new URL(request.url).pathname
		if (path !== '/login' && path !== '/signup') {
			throw new Response('Not found', { status: 404 })
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
