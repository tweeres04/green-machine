import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from '@remix-run/node'
import { Form, useLoaderData, useNavigation } from '@remix-run/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { goldenBootEntries, players } from '../schema'
import { asc, desc, eq, like, sql } from 'drizzle-orm'

import { getDb } from '~/lib/getDb'
import { useEffect, useRef } from 'react'
import { Add } from '~/components/ui/icons/add'
import { Remove } from '~/components/ui/icons/remove'
import RemoveUser from '~/components/ui/icons/remove-user'

export const meta: MetaFunction = () => {
	return [
		{ title: 'Green Machine' },
		{ name: 'description', content: 'Green machine' },
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

export default function Index() {
	const navigation = useNavigation()
	const players = useLoaderData<typeof loader>()
	const formRef = useRef<HTMLFormElement>()

	const isAddingPlayer =
		navigation.state === 'submitting' &&
		navigation.formAction === '/players' &&
		navigation.formMethod === 'POST'

	useEffect(() => {
		if (!isAddingPlayer) {
			formRef.current?.reset()
		}
	}, [isAddingPlayer])

	return (
		<div className="max-w-[700px] mx-auto space-y-10 px-2">
			<h1 className="text-3xl">Green Machine</h1>
			<div className="golden-boot">
				<h2 className="text-2xl mb-3">Golden boot</h2>
				<ul>
					{players.map((p) => (
						<li className="flex place-items-center space-y-1 gap-5" key={p.id}>
							<span className="grow">{p.name}</span>
							<span>
								{p.goals} goal{p.goals !== 1 ? 's' : ''}
							</span>
							<div className="flex gap-1">
								<Form method="post" action={`/players/${p.id}/goals`}>
									<Button variant="outline" size="sm">
										<Add className="w-4 h-14" />
									</Button>
								</Form>
								<Form
									method="post"
									action={`/players/${p.id}/goals/destroy_latest`}
								>
									<Button variant="destructive" size="sm">
										<Remove className="w-4 h-14" />
									</Button>
								</Form>
								<Form method="post" action={`/players/${p.id}/destroy`}>
									<Button variant="destructive" size="sm">
										<RemoveUser className="w-4 h-14" />
									</Button>
								</Form>
							</div>
						</li>
					))}
				</ul>
			</div>
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
		</div>
	)
}
