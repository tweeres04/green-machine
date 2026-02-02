import { Link } from '@remix-run/react'
import { Button } from '~/components/ui/button'
import Nav from '~/components/ui/nav'

export default function Canceled() {
	return (
		<>
			<Nav title="TeamStats" />
			<h1>No problem!</h1>
			<p>Your team is still set up with 3 free games. You can subscribe anytime to track unlimited games.</p>
			<Button asChild>
				<Link to="/">Back to my teams</Link>
			</Button>
		</>
	)
}
