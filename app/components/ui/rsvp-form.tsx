import { useEffect } from 'react'
import { useFetcher } from '@remix-run/react'
import { isPast } from 'date-fns'
import mixpanel from 'mixpanel-browser'
import { Button } from '~/components/ui/button'
import { DialogFooter } from '~/components/ui/dialog'

type RsvpFormPlayer = {
	rsvps: { id: number; gameId: number; rsvp: 'yes' | 'no' }[]
}

type RsvpFormGame = {
	id: number
	timestamp: string | null
}

export function RsvpForm({
	player,
	closeModal,
	game,
}: {
	player: RsvpFormPlayer
	closeModal?: () => void
	game: RsvpFormGame
}) {
	const fetcher = useFetcher()
	const saving = fetcher.state !== 'idle'

	const rsvp = player.rsvps.find((rsvp) => rsvp.gameId === game.id)

	useEffect(() => {
		if (closeModal && fetcher.state === 'loading') {
			closeModal()
		}
	}, [closeModal, fetcher.state])

	const action = rsvp
		? `/games/${game.id}/rsvps/${rsvp.id}`
		: `/games/${game.id}/rsvps`

	const method = rsvp ? 'patch' : 'post'

	const gameInPast = game.timestamp ? isPast(game.timestamp) : false

	function submitRsvp(value: 'yes' | 'no') {
		mixpanel.track('click rsvp response', { gameId: game.id, response: value })
		fetcher.submit({ value }, { method, action })
	}

	return (
		<fieldset className="space-y-3" disabled={saving}>
			<p>{gameInPast ? 'Did you go?' : 'Are you going?'}</p>
			<DialogFooter>
				{closeModal ? (
					<Button variant="secondary" onClick={closeModal}>
						Cancel
					</Button>
				) : null}
				<Button
					variant="destructive"
					className="w-full sm:w-auto"
					onClick={() => submitRsvp('no')}
				>
					No
				</Button>
				<Button
					className="w-full sm:w-auto"
					onClick={() => submitRsvp('yes')}
				>
					Yes
				</Button>
			</DialogFooter>
		</fieldset>
	)
}
