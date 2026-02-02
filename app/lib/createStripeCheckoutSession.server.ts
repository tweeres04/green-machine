import Stripe from 'stripe'
import invariant from 'tiny-invariant'

/**
 * Creates a Stripe checkout session for a team subscription.
 * Returns the checkout session URL for redirecting the user.
 */
export async function createStripeCheckoutSession({
	teamId,
	teamName,
	stripeCustomerId,
	origin,
	plan = 'yearly',
}: {
	teamId: number
	teamName: string
	stripeCustomerId: string | null
	origin: string
	plan?: 'yearly' | 'lifetime'
}): Promise<string> {
	invariant(process.env.STRIPE_SECRET_KEY, 'Missing STRIPE_SECRET_KEY in .env')

	const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
		apiVersion: '2024-10-28.acacia',
	})

	const price = plan === 'yearly' ? process.env.STRIPE_YEARLY_PRICE_ID : null

	invariant(price, 'Invalid plan')

	const mode =
		plan === 'yearly' ? 'subscription' : plan === 'lifetime' ? 'payment' : null

	invariant(mode, 'Invalid plan')

	const metadata =
		plan === 'yearly'
			? {
					subscription_data: {
						metadata: { team_id: teamId },
						description: teamName,
					},
			  }
			: plan === 'lifetime'
			? {
					payment_intent_data: {
						metadata: { team_id: teamId },
						description: teamName,
					},
			  }
			: {}

	const session = await stripe.checkout.sessions.create({
		line_items: [
			{
				price,
				quantity: 1,
			},
		],
		customer: stripeCustomerId ?? undefined,
		mode,
		...metadata,
		success_url: `${origin}/thankyou?checkout_session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/canceled?checkout_session_id={CHECKOUT_SESSION_ID}`,
		automatic_tax: { enabled: true },
		customer_update: stripeCustomerId
			? {
					address: 'auto',
			  }
			: undefined,
	})

	invariant(session.url, 'Missing session.url')

	return session.url
}
