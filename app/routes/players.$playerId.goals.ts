import { ActionFunctionArgs, redirect } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { goldenBootEntries } from '~/schema'

export async function action({ request, params }: ActionFunctionArgs) {
	const db = getDb()

	await db.insert(goldenBootEntries).values({
		timestamp: new Date().toISOString(),
		goals: 1,
		playerId: Number(params.playerId),
	})

	const referrer = new URL(request.headers.get('referer') ?? '/')
	const newPath = `${referrer.pathname}${referrer.search}`

	return redirect(newPath)
}
