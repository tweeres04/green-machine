import { ActionFunctionArgs, redirect } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { players } from '~/schema'

export async function action({ request }: ActionFunctionArgs) {
	const db = getDb()

	const formData = await request.formData()
	const name = formData.get('name')

	await db.insert(players).values({ name })

	return redirect('/?edit')
}
