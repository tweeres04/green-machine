import { useEffect } from 'react'
import { useFetcher } from '@remix-run/react'
import mixpanel from 'mixpanel-browser'
import { Button } from '~/components/ui/button'
import { DialogFooter } from '~/components/ui/dialog'

type RsvpFormPlayer = {
	rsvps: { id: number; gameId: number; rsvp: 'yes' | 'no' }[]
}

type RsvpFormGame = {
	id: number
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

	return (
		<fieldset className="space-y-3" disabled={saving}>
			<p>Are you going?</p>
			<DialogFooter>
				{closeModal ? (
					<Button variant="secondary" onClick={closeModal}>
						Cancel
					</Button>
				) : null}
				<fetcher.Form action={action} method={method}>
					<input type="hidden" name="value" value="no" />
					<Button
						variant="destructive"
						className="w-full sm:w-auto"
						onClick={() => {
							mixpanel.track('click rsvp response', {
								gameId: game.id,
								response: 'no',
							})
						}}
					>
						No
					</Button>
				</fetcher.Form>
				<fetcher.Form action={action} method={method}>
					<input type="hidden" name="value" value="yes" />
					<Button
						className="w-full sm:w-auto"
						onClick={() => {
							mixpanel.track('click rsvp response', {
								gameId: game.id,
								response: 'yes',
							})
						}}
					>
						Yes
					</Button>
				</fetcher.Form>
			</DialogFooter>
		</fieldset>
	)
}
