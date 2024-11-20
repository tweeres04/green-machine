import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import invariant from 'tiny-invariant'
import { getDb } from '~/lib/getDb'
import { teamSubscriptions, users } from '~/schema'

invariant(process.env.STRIPE_SECRET_KEY, 'Missing STRIPE_SECRET_KEY in .env')
invariant(
	process.env.STRIPE_ENDPOINT_SECRET,
	'Missing STRIPE_ENDPOINT_SECRET in .env'
)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET

async function updateSubscription(subscription: Stripe.Subscription) {
	const teamId = subscription.metadata.team_id

	if (typeof teamId !== 'string') {
		throw new Response('No team id', { status: 400 })
	}

	const stripeCustomerId = subscription.customer

	if (typeof stripeCustomerId !== 'string') {
		throw new Response('No customer id', { status: 400 })
	}

	const db = getDb()

	await db.transaction(async (tx) => {
		const teamSubscriptionValues = {
			stripeSubscriptionId: subscription.id,
			subscriptionStatus: subscription.status,
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
			periodEnd: subscription.current_period_end,
			teamId: Number(teamId),
		}
		const [teamUser] = await Promise.all([
			tx.query.teamsUsers.findFirst({
				where: (teamsUsers, { eq }) => eq(teamsUsers.teamId, Number(teamId)),
			}),
			tx
				.insert(teamSubscriptions)
				.values(teamSubscriptionValues)
				.onConflictDoUpdate({
					target: teamSubscriptions.stripeSubscriptionId,
					set: teamSubscriptionValues,
				}),
		])

		invariant(teamUser, 'No team user found')

		await tx
			.update(users)
			.set({
				stripeCustomerId,
			})
			.where(eq(users.id, teamUser.userId))
	})
}

export async function action({ request }: ActionFunctionArgs) {
	const body = await request.text()
	const signature = request.headers.get('stripe-signature')

	if (typeof signature !== 'string') {
		throw new Response('Invalid signature', { status: 400 })
	}

	let event: Stripe.Event
	try {
		event = await stripe.webhooks.constructEvent(
			body,
			signature,
			endpointSecret
		)
	} catch (err) {
		if (err instanceof Error) {
			throw new Response(err.message, { status: 500 })
		}
		throw err
	}

	if (event.type === 'checkout.session.completed') {
		const session = event.data.object as Stripe.Checkout.Session

		const lineItemResponse = await stripe.checkout.sessions.listLineItems(
			session.id
		)

		if (
			lineItemResponse.data[0]?.price?.product !==
			process.env.STRIPE_TEAMSTATS_PRODUCT_ID
		) {
			return new Response() // Not a TeamStats product
		}

		if (typeof session.subscription !== 'string') {
			throw new Response('No subscription id', { status: 400 })
		}
		const subscription = await stripe.subscriptions.retrieve(
			session.subscription
		)

		await updateSubscription(subscription)

		return new Response()
	}

	if (
		event.type === 'invoice.paid' ||
		event.type === 'invoice.payment_failed'
	) {
		const invoice = event.data.object as Stripe.Invoice

		if (
			invoice.lines.data[0]?.price?.product !==
			process.env.STRIPE_TEAMSTATS_PRODUCT_ID
		) {
			return new Response() // Not a TeamStats product
		}

		if (typeof invoice.subscription !== 'string') {
			throw new Response('No subscription id', { status: 400 })
		}
		const subscription = await stripe.subscriptions.retrieve(
			invoice.subscription
		)

		await updateSubscription(subscription)

		return new Response()
	}

	if (
		event.type === 'customer.subscription.deleted' ||
		event.type === 'customer.subscription.updated'
	) {
		const subscription = event.data.object as Stripe.Subscription

		if (
			subscription.items.data[0]?.price?.product !==
			process.env.STRIPE_TEAMSTATS_PRODUCT_ID
		) {
			return new Response() // Not a TeamStats product
		}

		await updateSubscription(subscription)

		return new Response()
	}

	return new Response()
}
