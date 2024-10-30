import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from '@remix-run/react'
import '~/tailwind.css'
import { json, LoaderFunctionArgs } from '@remix-run/node'
import { getDb } from '~/lib/getDb'
import { TeamColorContext } from '~/lib/teamColorContext'
import { authenticator } from '~/lib/auth.server'
import { UserContext } from '~/lib/userContext'

export async function loader({
	params: { teamSlug },
	request,
}: LoaderFunctionArgs) {
	const db = getDb()

	const user = await authenticator.isAuthenticated(request)

	if (!teamSlug) {
		return json({ color: 'gray', user })
	}

	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
	})

	return json({ color: team?.color, user })
}

export function Layout({ children }: { children: React.ReactNode }) {
	const { color, user } = useLoaderData<typeof loader>() ?? {} // error pages like 404 don't allow for loader data

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />

				<Meta />
				<Links />
				<style
					dangerouslySetInnerHTML={{
						__html: `
						html {
							font-size: 20px;
						}
					`,
					}}
				></style>
			</head>
			<body className={`bg-${color}-50`}>
				<TeamColorContext.Provider value={color}>
					<UserContext.Provider value={user}>
						<div className={`max-w-[700px] mx-auto space-y-8 p-2`}>
							{children}
						</div>
					</UserContext.Provider>
				</TeamColorContext.Provider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export default function App() {
	return <Outlet />
}
