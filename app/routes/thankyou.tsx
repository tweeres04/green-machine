import { Link } from '@remix-run/react'
import { Button } from '~/components/ui/button'

export default function ThankYou() {
	return (
		<>
			<h1>Thanks for buying TeamStats!</h1>
			<Button asChild>
				<Link to="/">Go to my teams</Link>
			</Button>
		</>
	)
}
