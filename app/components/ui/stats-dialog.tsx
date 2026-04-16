import { ReactNode, useState } from 'react'
import { format } from 'date-fns'
import { Mail, MailCheck, MailX } from 'lucide-react'
import { Button } from '~/components/ui/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog'
import { RsvpForm } from '~/components/ui/rsvp-form'

type StatEntryWithPlayer = {
	id: number
	type: string
	playerId: number
	player: { name: string }
}

type StatsDialogGame = {
	id: number
	opponent: string | null
	timestamp: string | null
}

type StatsDialogPlayer = {
	rsvps: { id: number; gameId: number; rsvp: 'yes' | 'no' }[]
}

export function StatsDialog({
	children,
	statEntries,
	game,
	player,
}: {
	children: ReactNode
	statEntries: StatEntryWithPlayer[]
	game: StatsDialogGame
	player?: StatsDialogPlayer | null
}) {
	const [open, setOpen] = useState(false)
	const [showRsvpForm, setShowRsvpForm] = useState(false)

	const rsvp = player?.rsvps.find((r) => r.gameId === game.id)

	const groupedStats: Record<number, StatEntryWithPlayer[]> = {}
	for (const entry of statEntries) {
		if (!groupedStats[entry.playerId]) groupedStats[entry.playerId] = []
		groupedStats[entry.playerId].push(entry)
	}

	const formattedDate = game.timestamp
		? format(game.timestamp, 'E MMM d')
		: 'TBD'
	const formattedTime = game.timestamp
		? format(game.timestamp, 'h:mma')
		: 'TBD'

	const sortedGroupedStats = Object.entries(groupedStats).toSorted(
		([, a], [, b]) => a[0].player.name.localeCompare(b[0].player.name)
	)

	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				setOpen(value)
				if (!value) setShowRsvpForm(false)
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{game.opponent ?? 'Unknown opponent'} - {formattedDate} at{' '}
						{formattedTime}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-1">
					{sortedGroupedStats.map(([playerId, entries]) => {
						const player_ = entries[0].player
						const goals = entries.filter(
							(entry) => entry.type === 'goal'
						).length
						const assists = entries.filter(
							(entry) => entry.type === 'assist'
						).length
						return (
							<div
								key={playerId}
								className="grid grid-cols-2 sm:grid-cols-[1fr_3fr]"
							>
								<div>{player_.name}:</div>
								<div>
									{goals > 0 && `${goals} goal${goals === 1 ? '' : 's'}`}
									{goals > 0 && assists > 0 && ', '}
									{assists > 0 &&
										`${assists} assist${assists === 1 ? '' : 's'}`}
								</div>
							</div>
						)
					})}
				</div>
				{player ? (
					showRsvpForm ? (
						<RsvpForm
							player={player}
							game={game}
							closeModal={() => setShowRsvpForm(false)}
						/>
					) : (
						<DialogFooter>
							<Button
								size="icon"
								variant={rsvp ? 'secondary' : 'default'}
								onClick={() => setShowRsvpForm(true)}
							>
								{rsvp ? (
									rsvp.rsvp === 'yes' ? (
										<MailCheck />
									) : (
										<MailX />
									)
								) : (
									<Mail />
								)}
							</Button>
						</DialogFooter>
					)
				) : (
					<DialogFooter>
						<DialogClose>
							<Button>Done</Button>
						</DialogClose>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	)
}
