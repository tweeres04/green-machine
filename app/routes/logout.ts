import { ActionFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/lib/auth.server'

export async function loader({ request }: ActionFunctionArgs) {
	await authenticator.logout(request, { redirectTo: '/login' })
}
