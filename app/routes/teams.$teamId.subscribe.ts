import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { createStripeCheckoutSession } from '~/lib/createStripeCheckoutSession.server'

export async function loader({
	request,
	params: { teamId },
}: LoaderFunctionArgs) {
	invariant(teamId, 'Missing teamId parameter')

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, Number(teamId))

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	const db = getDb()

	// Fetch team details
	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.id, Number(teamId)),
	})

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	// Create Stripe checkout session
	const origin = new URL(request.url).origin
	const checkoutUrl = await createStripeCheckoutSession({
		teamId: team.id,
		teamName: team.name,
		stripeCustomerId: user.stripeCustomerId,
		origin,
		plan: 'yearly',
	})

	return redirect(checkoutUrl, { status: 303 })
}
