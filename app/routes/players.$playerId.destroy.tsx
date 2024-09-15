import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { getDb } from '~/lib/getDb'
import { players } from '~/schema'

export async function action({ params }: ActionFunctionArgs) {
	const db = getDb()

	return db.delete(players).where(eq(players.id, Number(params.playerId)))
}
