import { ActionFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { authenticator } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { mixpanelServer } from '~/lib/mixpanel.server'
import { rsvps, User } from '~/schema'
async function handlePost(user: User, gameId: string, formData: FormData) {
	const db = getDb()

	const value = formData.get('value')

	if (value !== 'yes' && value !== 'no') {
		throw new Response('RSVP response must be yes or no', { status: 400 })
	}

	const dbUser = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.id, user.id),
		columns: {},
		with: {
			receivedInvites: {
				columns: {},
				with: {
					player: {
						columns: { id: true },
						with: {
							team: {
								columns: {},
								with: {
									games: {
										columns: { id: true },
										where: (games, { eq }) => eq(games.id, Number(gameId)),
									},
								},
							},
						},
					},
				},
			},
		},
	})

	// todo: move this receivedInvites check to the db — probably can't use the query api
	const receivedInvite = dbUser?.receivedInvites.find((ri) =>
		ri.player.team.games.some((g) => g.id === Number(gameId))
	)
	const game = receivedInvite?.player?.team?.games[0]

	if (!game) {
		throw new Response(null, { status: 404 })
	}

	const playerId = receivedInvite?.player?.id

	invariant(playerId, 'No playerId')

	await db.insert(rsvps).values({
		playerId,
		gameId: Number(gameId),
		rsvp: value,
	})

	// Event and property names match the old client-side event for continuity
	mixpanelServer.track('click rsvp response', {
		distinct_id: user.id,
		gameId: Number(gameId),
		response: value,
	})

	return null
}

async function handlePatch(
	user: User,
	gameId: string,
	rsvpId: string,
	formData: FormData
) {
	const db = getDb()

	const dbUser = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.id, user.id),
		columns: {},
		with: {
			receivedInvites: {
				columns: {},
				with: {
					player: {
						columns: {},
						with: {
							rsvps: {
								where: (rsvps, { eq }) => eq(rsvps.id, Number(rsvpId)),
							},
						},
					},
				},
			},
		},
	})

	invariant(dbUser, 'No dbUser found')

	// todo: move this receivedInvites check to the db — probably can't use the query api
	const receivedInvite = dbUser?.receivedInvites.find((ri) =>
		ri.player.rsvps.some((r) => r.id === Number(rsvpId))
	)
	const rsvp = receivedInvite?.player.rsvps[0]

	if (!rsvp) {
		throw new Response(null, { status: 404 })
	}

	const value = formData.get('value')

	if (value !== 'yes' && value !== 'no') {
		throw new Response('RSVP response must be yes or no', { status: 400 })
	}

	await db
		.update(rsvps)
		.set({
			rsvp: value,
		})
		.where(eq(rsvps.id, Number(rsvpId)))

	mixpanelServer.track('click rsvp response', {
		distinct_id: user.id,
		gameId: Number(gameId),
		response: value,
	})

	return null
}

export async function action({ params, request }: ActionFunctionArgs) {
	const { gameId } = params

	invariant(gameId, 'No gameId')

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const formData = await request.formData()

	if (request.method.toLowerCase() === 'post') {
		return handlePost(user, gameId, formData)
	}

	if (request.method.toLowerCase() === 'patch') {
		const { rsvpId } = params
		if (!rsvpId) {
			throw new Response(null, { status: 400 })
		}
		return handlePatch(user, gameId, rsvpId, formData)
	}

	throw new Response(null, { status: 404 })
}
