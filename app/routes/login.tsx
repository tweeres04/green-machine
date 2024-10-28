// app/routes/login.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { Form, Link } from '@remix-run/react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { authenticator } from '~/lib/auth.server'

// First we create our UI with the form doing a POST and the inputs with the
// names we are going to use in the strategy
export default function Login() {
	return (
		<Form method="post" className="space-y-3">
			<h1 className="text-2xl">Sign in</h1>
			<div>
				<label htmlFor="email_input">Email</label>
				<Input type="email" name="email" id="email_input" required />
			</div>
			<div>
				<label htmlFor="password_input">Password</label>
				<Input
					type="password"
					name="password"
					autoComplete="current-password"
					required
					id="password_input"
				/>
			</div>
			<p>
				No account?{' '}
				<Button asChild variant="link">
					<Link to="/signup">Sign up</Link>
				</Button>
			</p>
			<Button>Sign In</Button>
		</Form>
	)
}

// Second, we need to export an action function, here we will use the
// `authenticator.authenticate method`
export async function action({ request }: ActionFunctionArgs) {
	// we call the method with the name of the strategy we want to use and the
	// request object, optionally we pass an object with the URLs we want the user
	// to be redirected to after a success or a failure
	return await authenticator.authenticate('user-pass', request, {
		successRedirect: '/',
		failureRedirect: '/login',
	})
}

// Finally, we can export a loader function where we check if the user is
// authenticated with `authenticator.isAuthenticated` and redirect to /
// if it is or return null if it's not
export async function loader({ request }: LoaderFunctionArgs) {
	// If the user is already authenticated redirect to / directly
	return await authenticator.isAuthenticated(request, {
		successRedirect: '/',
	})
}
