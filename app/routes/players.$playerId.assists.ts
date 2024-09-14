import { ActionFunctionArgs, redirect } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { statEntries } from '~/schema'

export async function action({ request, params }: ActionFunctionArgs) {
	const db = getDb()

	await db.insert(statEntries).values({
		timestamp: new Date().toISOString(),
		playerId: Number(params.playerId),
		type: 'assist',
	})

	const referrer = new URL(request.headers.get('referer') ?? '/')
	const newPath = `${referrer.pathname}${referrer.search}`

	return redirect(newPath)
}
