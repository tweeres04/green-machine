import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from '@remix-run/react'
import './tailwind.css'
import { json, LoaderFunctionArgs } from '@remix-run/node'
import { getDb } from './lib/getDb'
import { TeamColorContext } from './lib/teamColorContext'

export async function loader({ params: { teamSlug } }: LoaderFunctionArgs) {
	const db = getDb()

	if (!teamSlug) {
		return null
	}

	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.slug, teamSlug),
	})

	return json({ color: team?.color })
}

export function Layout({ children }: { children: React.ReactNode }) {
	const { color = 'gray' } = useLoaderData<typeof loader>() ?? {}

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
					<div className={`max-w-[700px] mx-auto space-y-8 p-2`}>
						{children}
					</div>
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
