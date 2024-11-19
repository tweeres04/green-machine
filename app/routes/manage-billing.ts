import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import { authenticator } from '~/lib/auth.server'
import Stripe from 'stripe'
import invariant from 'tiny-invariant'

export async function loader({ request }: LoaderFunctionArgs) {
	invariant(process.env.STRIPE_SECRET_KEY, 'Missing STRIPE_SECRET_KEY in .env')
	invariant(process.env.BASE_URL, 'Missing BASE_URL in .env')

	const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
	const user = await authenticator.isAuthenticated(request)

	if (!user || !user.stripeCustomerId) {
		throw new Response(null, { status: 401 })
	}

	const portalSession = await stripe.billingPortal.sessions.create({
		customer: user.stripeCustomerId,
		return_url: request.headers.get('referer') ?? process.env.BASE_URL,
	})

	return redirect(portalSession.url, { status: 303 })
}
