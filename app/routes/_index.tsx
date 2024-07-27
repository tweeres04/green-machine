import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import {
	Form,
	useLoaderData,
	useNavigation,
	useSearchParams,
} from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { goldenBootEntries, players } from '../schema'
import { asc, desc, eq, sql } from 'drizzle-orm'

import { getDb } from '~/lib/getDb'
import { useEffect, useRef } from 'react'
import { Add } from '~/components/ui/icons/add'
import { Remove } from '~/components/ui/icons/remove'
import RemoveUser from '~/components/ui/icons/remove-user'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { useToast } from '~/components/ui/use-toast'
import { Copy } from '~/components/ui/icons/copy'
import { loadGames } from '~/lib/loadGames'

export const meta: MetaFunction = () => {
	return [
		{ title: 'Bears' },
		{ name: 'description', content: 'Bears' },
		{ name: 'robots', context: 'noindex' },
	]
}

function CopyStandingsButton({
	players,
}: {
	players: Awaited<ReturnType<typeof loader>>['playersWithGoals']
}) {
	const { toast } = useToast()
	return (
		<Button
			title="Copy standings"
			variant="secondary"
			className="w-full sm:w-auto flex gap-1"
			onClick={async () => {
				await window.navigator.clipboard
					.writeText(`The Bears golden boot standings:

${players.map((p) => `${p.name}: ${p.goals}`).join('\n')}`)

				toast({
					description: 'Standings copied to clipboard',
				})
			}}
		>
			<span>Copy standings</span> <Copy />
		</Button>
	)
}

export async function loader({ request }: LoaderFunctionArgs) {
	const db = getDb()

	const gamesPromise = loadGames()

	const playersWithGoalsPromise = db
		.select({
			id: players.id,
			name: players.name,
			goals: sql<number>`coalesce(sum(goals), 0) as goals`,
		})
		.from(players)
		.leftJoin(goldenBootEntries, eq(players.id, goldenBootEntries.playerId))
		.groupBy(players.id)
		.orderBy(desc(sql`goals`), asc(players.name))

	const [playersWithGoals, games] = await Promise.all([
		playersWithGoalsPromise,
		gamesPromise,
	])

	return { playersWithGoals, games }
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
	const formattedTime = new Intl.DateTimeFormat('en-CA', {
		weekday: 'long',
		hour: 'numeric',
		minute: 'numeric',
	}).format(new Date(nextGame?.time))

	return (
		<div className="next-game">
			<div className="flex mb-2">
				<h2 className="text-2xl grow">Next game</h2>
				<Button
					title="Copy next game"
					variant="secondary"
					onClick={async () => {
						await window.navigator.clipboard.writeText(`Bears next game:

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
	)
}

export default function Index() {
	const { playersWithGoals, games } = useLoaderData<typeof loader>()
	const formRef = useRef<HTMLFormElement>(null)
	const navigation = useNavigation()
	const [searchParams] = useSearchParams()

	const editMode = searchParams.has('edit')

	const isUpdatingGoals =
		navigation.state === 'submitting' &&
		/\/players\/\d+?\/goals/.test(navigation.formAction) &&
		navigation.formMethod === 'POST'

	useClearNewPlayerForm(formRef)

	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<div className="flex items-center gap-2">
				<img
					src="/bears.png"
					alt="Bears logo"
					className="size-16 object-cover"
				/>
				<h1 className="grow text-3xl">The Bears</h1>
			</div>
			<NextGame games={games as Game[]} />
			<div className="golden-boot">
				<h2 className="text-2xl mb-3">Golden boot</h2>
				<ul className="space-y-2">
					{playersWithGoals.map((p) => (
						<li className="flex items-center gap-5" key={p.id}>
							<Avatar>
								<AvatarImage
									src={`/photos/${p.name}.webp`}
									className="object-cover"
									alt={`Avatar for ${p.name}`}
								/>
								<AvatarFallback>{p.name[0]}</AvatarFallback>
							</Avatar>

							<span className="grow">{p.name}</span>
							<span>
								{Array.from({ length: p.goals }).map((_, i) => (
									<span key={i} className="inline-block -ml-2">
										⚽️
									</span>
								))}
							</span>
							<span>{p.goals}</span>
							<div className="flex gap-1">
								{editMode ? (
									<Form
										method="post"
										action={`/players/${p.id}/goals/destroy_latest`}
									>
										<Button
											variant="secondary"
											size="sm"
											disabled={isUpdatingGoals}
											aria-label="Remove latest goal"
										>
											<Remove />
										</Button>
									</Form>
								) : null}
								<Form method="post" action={`/players/${p.id}/goals`}>
									<Button
										variant="secondary"
										size="sm"
										disabled={isUpdatingGoals}
										aria-label="Add goal"
									>
										<Add />
									</Button>
								</Form>
								{editMode ? (
									<Form method="post" action={`/players/${p.id}/destroy`}>
										<Button
											variant="outline"
											size="sm"
											aria-label="Remove player"
										>
											<RemoveUser />
										</Button>
									</Form>
								) : null}
							</div>
						</li>
					))}
				</ul>
			</div>
			<CopyStandingsButton players={playersWithGoals} />
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
