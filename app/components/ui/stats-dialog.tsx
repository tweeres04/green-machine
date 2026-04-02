import { ReactNode } from 'react'
import { format } from 'date-fns'
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

type StatEntryWithPlayer = {
	id: number
	type: string
	playerId: number
	player: { name: string }
}

type StatsDialogGame = {
	opponent: string | null
	timestamp: string | null
}

export function StatsDialog({
	children,
	statEntries,
	game,
}: {
	children: ReactNode
	statEntries: StatEntryWithPlayer[]
	game: StatsDialogGame
}) {
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
		<Dialog>
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
						const player = entries[0].player
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
								<div>{player.name}:</div>
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
				<DialogFooter>
					<DialogClose>
						<Button>Done</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
