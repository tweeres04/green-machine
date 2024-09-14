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
				<link rel="icon" type="image/png" href="/green_machine.svg"></link>
				<link rel="manifest" href="/manifest.json" />

				{/* <!-- HTML Meta Tags --> */}
				<title>Green Machine</title>
				<meta name="description" content="Green Machine stats" />

				{/* <!-- Facebook Meta Tags --> */}
				<meta property="og:url" content="https://green-machine.tweeres.com" />
				<meta property="og:type" content="website" />
				<meta property="og:title" content="Green Machine" />
				<meta property="og:description" content="Green Machine stats" />
				<meta property="og:image" content="/green_machine.svg" />

				{/* <!-- Twitter Meta Tags --> */}
				<meta name="twitter:card" content="summary_large_image" />
				<meta property="twitter:domain" content="green-machine.tweeres.com" />
				<meta
					property="twitter:url"
					content="https://green-machine.tweeres.com"
				/>
				<meta name="twitter:title" content="Green Machine" />
				<meta name="twitter:description" content="Green Machine stats" />
				<meta name="twitter:image" content="/green_machine.svg" />

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
			<body className="bg-green-50">
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
