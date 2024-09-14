import type { MetaFunction } from '@remix-run/node'
import {
	Form,
	Link,
	useLoaderData,
	useNavigation,
	useSearchParams,
} from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'

import { getDb } from '~/lib/getDb'
import { useEffect, useRef } from 'react'
import { Add } from '~/components/ui/icons/add'
import { Remove } from '~/components/ui/icons/remove'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { useToast } from '~/components/ui/use-toast'
import { Copy } from '~/components/ui/icons/copy'
import { loadGames } from '~/lib/loadGames'
import { Eye } from '~/components/ui/icons/eye'
import { Pencil } from '~/components/ui/icons/pencil'
import RemoveUser from '~/components/ui/icons/remove-user'

export const meta: MetaFunction = () => {
	return [
		{ title: 'Gree Machine' },
		{
			name: 'description',
			content: 'Green Machine stats',
		},
		{ name: 'robots', context: 'noindex' },
	]
}

function CopyStandingsButton({
	players,
}: {
	players: Awaited<ReturnType<typeof loader>>['playersWithStats']
}) {
	const { toast } = useToast()
	return (
		<Button
			title="Copy standings"
			variant="secondary"
			onClick={async () => {
				await window.navigator.clipboard.writeText(`Green Machine stats:

${players
	.toSorted((a, b) => {
		const aGoals = a.statEntries.filter((se) => se.type === 'goal').length
		const bGoals = b.statEntries.filter((se) => se.type === 'goal').length
		return bGoals - aGoals
	})
	.map((p) => {
		const goals = p.statEntries.filter((s) => s.type === 'goal').length
		const assists = p.statEntries.filter((s) => s.type === 'assist').length
		return `${p.name}: ${goals}G ${assists}A`
	})
	.join('\n')}`)

				toast({
					description: 'Standings copied to clipboard',
				})
			}}
		>
			<Copy />
		</Button>
	)
}

export async function loader() {
	const db = getDb()

	const gamesPromise = loadGames()

	const playersWithStatsPromise = db.query.players.findMany({
		with: {
			statEntries: true,
		},
		orderBy: (players, { asc }) => [asc(players.name)],
	})

	const [playersWithStats, games] = await Promise.all([
		playersWithStatsPromise,
		gamesPromise,
	])

	return { playersWithStats, games }
}

function useClearNewPlayerForm(
	formRef: React.MutableRefObject<HTMLFormElement | null>
) {
	const navigation = useNavigation()
	const isAddingPlayer =
		navigation.state === 'submitting' &&
		navigation.formAction === '/players' &&
		navigation.formMethod === 'POST'

	useEffect(() => {
		if (!isAddingPlayer) {
			formRef.current?.reset()
		}
	}, [formRef, isAddingPlayer])
}

type Game = { time: string; field: string; opponent: string }

function NextGame({ games }: { games: Game[] }) {
	const now = new Date()
	const nextGame = games.filter((game) => new Date(game.time) > now)[0]
	const { toast } = useToast()
	const formattedTime = nextGame
		? new Intl.DateTimeFormat('en-CA', {
				weekday: 'long',
				hour: 'numeric',
				minute: 'numeric',
		  }).format(new Date(nextGame?.time))
		: null

	return nextGame ? (
		<div className="next-game">
			<div className="flex mb-2">
				<h2 className="text-2xl grow">Next game</h2>
				<Button
					title="Copy next game"
					variant="secondary"
					onClick={async () => {
						await window.navigator.clipboard.writeText(`Green Machine next game:

${formattedTime}
${nextGame.field}
vs ${nextGame.opponent}`)
						toast({
							description: 'Next game copied to clipboard',
						})
					}}
				>
					<Copy />
				</Button>
			</div>
			<div className="font-bold">{formattedTime}</div>
			<div className="text-[14px]">{nextGame.field}</div>
			<div className="text-[14px]">vs {nextGame.opponent}</div>
		</div>
	) : null
}

export default function Index() {
	const { playersWithStats, games } = useLoaderData<typeof loader>()
	const formRef = useRef<HTMLFormElement>(null)
	const navigation = useNavigation()
	const [searchParams] = useSearchParams()

	const editMode = searchParams.has('edit')

	const isUpdating =
		navigation.state === 'submitting' &&
		/\/players\/\d+?\/(goals|assists)/.test(navigation.formAction) &&
		navigation.formMethod === 'POST'

	useClearNewPlayerForm(formRef)

	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<div className="flex items-center gap-2">
				<img
					src="/green_machine.svg"
					alt="Green Machine logo"
					className="size-16 object-cover"
				/>
				<h1 className="grow text-3xl">Green Machine</h1>
			</div>
			<NextGame games={games as Game[]} />
			<div className="golden-boot">
				<div className="flex gap-1 mb-3 items-center">
					<h2 className="grow text-2xl">Golden boot</h2>
					<Link to={editMode ? '/' : '/?edit'}>
						<Button variant="secondary">
							{editMode ? <Eye /> : <Pencil />}
						</Button>
					</Link>
					<CopyStandingsButton players={playersWithStats} />
				</div>
				<ul className="space-y-2">
					{playersWithStats.map((p) => {
						const goalCount = p.statEntries.filter(
							(s) => s.type === 'goal'
						).length
						const assistCount = p.statEntries.filter(
							(s) => s.type === 'assist'
						).length
						return (
							<li className="flex items-center gap-3" key={p.id}>
								<Avatar>
									<AvatarImage
										src={`/photos/${p.name}.webp`}
										className="object-cover"
										alt={`Avatar for ${p.name}`}
									/>
									<AvatarFallback>{p.name[0]}</AvatarFallback>
								</Avatar>

								<span className="grow">{p.name}</span>
								{editMode ? null : (
									<span className="text-2xl">
										{p.statEntries.map(({ type }, i) => (
											<span key={i} className="inline-block -ml-2">
												{type === 'goal' ? '⚽️' : '🍎'}
											</span>
										))}
									</span>
								)}
								<span className="text-2xl">
									{p.statEntries.length === 0
										? '-'
										: `${goalCount}G ${assistCount}A`}
								</span>
								{editMode ? (
									<div className="flex gap-1">
										<Form method="post" action={`/players/${p.id}/assists`}>
											<Button
												variant="secondary"
												size="sm"
												disabled={isUpdating}
												aria-label="Add assist"
											>
												🍎
												<Add />
											</Button>
										</Form>
										<Form
											method="post"
											action={`/players/${p.id}/assists/destroy_latest`}
										>
											<Button
												variant="secondary"
												size="sm"
												disabled={isUpdating}
												aria-label="Remove assist"
											>
												🍎
												<Remove />
											</Button>
										</Form>
										<Form method="post" action={`/players/${p.id}/goals`}>
											<Button
												variant="secondary"
												size="sm"
												disabled={isUpdating}
												aria-label="Add goal"
											>
												⚽️
												<Add />
											</Button>
										</Form>
										<Form
											method="post"
											action={`/players/${p.id}/goals/destroy_latest`}
										>
											<Button
												variant="secondary"
												size="sm"
												disabled={isUpdating}
												aria-label="Remove goal"
											>
												⚽️
												<Remove />
											</Button>
										</Form>
										<Form method="post" action={`/players/${p.id}/destroy`}>
											<Button
												variant="outline"
												size="sm"
												aria-label="Remove player"
											>
												<RemoveUser />
											</Button>
										</Form>
									</div>
								) : null}
							</li>
						)
					})}
				</ul>
			</div>
			{editMode ? (
				<div className="players space-y-3">
					<h2 className="text-2xl mb-3">New player</h2>
					<Form
						method="post"
						action="/players"
						className="space-y-3"
						ref={formRef}
					>
						<Input name="name" />
						<Button>Add player</Button>
					</Form>
				</div>
			) : null}
		</div>
	)
}
