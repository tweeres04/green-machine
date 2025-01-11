import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { getDb } from '~/lib/getDb'
import { games } from '~/schema'

// todo: protect this
export async function action({ params }: ActionFunctionArgs) {
	const db = getDb()

	return db.delete(games).where(eq(games.id, Number(params.gameId)))
}
