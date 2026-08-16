import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'

import { authenticator } from '~/lib/auth.server'
import { endElevation, isSupportUser } from '~/lib/support.server'

export async function action({ request }: ActionFunctionArgs) {
	const user = await authenticator.isAuthenticated(request)

	if (!isSupportUser(user) || !user) {
		throw new Response(null, { status: 404 })
	}

	endElevation(user.id)

	// The banner posts this with a fetcher, so revalidation is what makes it
	// disappear. No redirect needed
	return json({ ok: true })
}
