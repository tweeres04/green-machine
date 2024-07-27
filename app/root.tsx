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
