import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { getDb } from '~/lib/getDb'
import { statEntries } from '~/schema'

export async function action({ params, request }: ActionFunctionArgs) {
	if (request.method.toLowerCase() !== 'patch') {
		throw new Response(null, { status: 404 })
	}

	const db = getDb()

	const { statId } = params
	const formData = await request.formData()

	const timestamp = formData.get('timestamp')

	if (typeof timestamp !== 'string') {
		throw new Response('Timestamp is required', { status: 400 })
	}

	return db
		.update(statEntries)
		.set({
			timestamp,
		})
		.where(eq(statEntries.id, Number(statId)))
}
