import { ActionFunction, redirect } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { teams, teamsUsers } from '~/schema'
import Stripe from 'stripe'

export const action: ActionFunction = async ({ request }) => {
	invariant(process.env.STRIPE_SECRET_KEY, 'Missing STRIPE_SECRET_KEY in .env')
	const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
		apiVersion: '2024-10-28.acacia',
	})

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response('Not authorized', { status: 401 })
	}

	const formData = await request.formData()
	const name = formData.get('name')
	const slug = formData.get('slug')
	const plan = formData.get('plan')

	if (
		typeof name !== 'string' ||
		typeof slug !== 'string' ||
		typeof plan !== 'string'
	) {
		throw new Response('Invalid form', {
			status: 400,
			statusText: 'Invalid form',
		})
	}

	const db = getDb()

	const results = await db.transaction(async (tx) => {
		const newTeamRows = await tx
			.insert(teams)
			.values({
				name: name,
				slug: slug,
			})
			.returning()
		await tx.insert(teamsUsers).values({
			teamId: newTeamRows[0].id,
			userId: user.id,
		})

		return newTeamRows
	})

	const newTeam = results[0]

	invariant(newTeam, 'New team not created')

	const newTeamId = newTeam.id
	const newTeamName = newTeam.name

	const price = plan === 'yearly' ? process.env.STRIPE_YEARLY_PRICE_ID : null

	invariant(price, 'Invalid plan')

	const mode =
		plan === 'yearly' ? 'subscription' : plan === 'lifetime' ? 'payment' : null

	invariant(mode, 'Invalid plan')

	const metadata =
		plan === 'yearly'
			? {
					subscription_data: {
						metadata: { team_id: newTeamId },
						description: newTeamName,
					},
			  }
			: plan === 'lifetime'
			? {
					payment_intent_data: {
						metadata: { team_id: newTeamId },
						description: newTeamName,
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
		customer: user.stripeCustomerId ?? undefined,
		mode,
		...metadata,
		success_url: `${request.headers.get(
			'origin'
		)}/thankyou?checkout_session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${request.headers.get(
			'origin'
		)}/canceled?checkout_session_id={CHECKOUT_SESSION_ID}`,
	})

	invariant(session.url, 'Missing session.url')

	return redirect(session.url, { status: 303 })
}
