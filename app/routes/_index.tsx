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

export const meta: MetaFunction = () => {
	return [
		{ title: 'Bears' },
		{ name: 'description', content: 'Bears' },
		{ name: 'robots', context: 'noindex' },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const db = getDb()

	const playersWithGoals = await db
		.select({
			id: players.id,
			name: players.name,
			goals: sql<number>`coalesce(sum(goals), 0) as goals`,
		})
		.from(players)
		.leftJoin(goldenBootEntries, eq(players.id, goldenBootEntries.playerId))
		.groupBy(players.id)
		.orderBy(desc(sql`goals`), asc(players.name))

	return playersWithGoals
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

export default function Index() {
	const players = useLoaderData<typeof loader>()
	const formRef = useRef<HTMLFormElement>(null)
	const navigation = useNavigation()
	const [searchParams] = useSearchParams()

	const editMode = searchParams.has('edit')

	const isAddingGoal =
		navigation.state === 'submitting' &&
		/\/players\/\d+?\/goals/.test(navigation.formAction) &&
		navigation.formMethod === 'POST'

	useClearNewPlayerForm(formRef)

	return (
		<div className="max-w-[700px] mx-auto space-y-8 p-2">
			<h1 className="text-3xl">The Bears</h1>
			<div className="golden-boot">
				<h2 className="text-2xl mb-3">Golden boot</h2>
				<ul>
					{players.map((p) => (
						<li className="flex place-items-center space-y-2 gap-5" key={p.id}>
							<Avatar>
								<AvatarImage
									src={`/photos/${p.name}.webp`}
									className="object-cover"
								/>
								<AvatarFallback>{p.name[0]}</AvatarFallback>
							</Avatar>

							<span className="grow">{p.name}</span>
							<span>
								{p.goals} goal{p.goals !== 1 ? 's' : ''}
							</span>
							<div className="flex gap-1">
								{editMode ? (
									<Form
										method="post"
										action={`/players/${p.id}/goals/destroy_latest`}
									>
										<Button
											variant="secondary"
											size="sm"
											disabled={isAddingGoal}
										>
											<Remove />
										</Button>
									</Form>
								) : null}
								<Form method="post" action={`/players/${p.id}/goals`}>
									<Button variant="secondary" size="sm">
										<Add />
									</Button>
								</Form>
								{editMode ? (
									<Form method="post" action={`/players/${p.id}/destroy`}>
										<Button variant="outline" size="sm">
											<RemoveUser />
										</Button>
									</Form>
								) : null}
							</div>
						</li>
					))}
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
