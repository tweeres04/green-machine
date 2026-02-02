import { Link } from '@remix-run/react'
import { Button } from '~/components/ui/button'
import Nav from '~/components/ui/nav'

export default function ThankYou() {
	return (
		<>
			<Nav title="TeamStats" />
			<h1>You're all set!</h1>
			<p>Thanks for subscribing to TeamStats. You can now track unlimited games for your team.</p>
			<Button asChild>
				<Link to="/">Back to my teams</Link>
			</Button>
		</>
	)
}
