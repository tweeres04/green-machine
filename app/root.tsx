import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from '@remix-run/react'
import './tailwind.css'

import { Toaster } from '~/components/ui/toaster'

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" type="image/png" href="/bears.png"></link>
				<link rel="manifest" href="/manifest.json" />

				{/* <!-- HTML Meta Tags --> */}
				<title>The Bears</title>
				<meta
					name="description"
					content="The Bears next game and golden boot standings"
				/>

				{/* <!-- Facebook Meta Tags --> */}
				<meta property="og:url" content="https://bears.tweeres.com" />
				<meta property="og:type" content="website" />
				<meta property="og:title" content="Bears" />
				<meta
					property="og:description"
					content="The Bears next game and golden boot standings"
				/>
				<meta property="og:image" content="/bears512.png" />

				{/* <!-- Twitter Meta Tags --> */}
				<meta name="twitter:card" content="summary_large_image" />
				<meta property="twitter:domain" content="bears.tweeres.com" />
				<meta property="twitter:url" content="https://bears.tweeres.com" />
				<meta name="twitter:title" content="Bears" />
				<meta
					name="twitter:description"
					content="The Bears next game and golden boot standings"
				/>
				<meta name="twitter:image" content="/bears512.png" />

				{/* <!-- Meta Tags Generated via https://www.opengraph.xyz --></meta> */}

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
			<body className="bg-orange-50">
				{children}
				<ScrollRestoration />
				<Scripts />
				<Toaster />
			</body>
		</html>
	)
}

export default function App() {
	return <Outlet />
}
