import { ActionFunctionArgs } from '@remix-run/node'
import { and, eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { teamsUsers } from '~/schema'

export async function action({
	request,
	params: { teamId },
}: ActionFunctionArgs) {
	invariant(teamId, 'Missing teamId parameter')

	const method = request.method.toLowerCase()
	if (method !== 'post' && method !== 'delete') {
		throw new Response(null, { status: 404 })
	}

	const [user, formData] = await Promise.all([
		authenticator.isAuthenticated(request),
		request.formData(),
	])

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, Number(teamId))

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	const targetUserId = Number(formData.get('userId'))

	if (!targetUserId) {
		throw new Response('userId is required', { status: 400 })
	}

	const db = getDb()

	if (method === 'post') {
		const [acceptedInvites, existingAdmin] = await Promise.all([
			// Only users who accepted an invite to this team can become admins
			db.query.userInvites.findMany({
				where: (userInvites, { and, eq, isNotNull }) =>
					and(
						eq(userInvites.userId, targetUserId),
						isNotNull(userInvites.acceptedAt)
					),
				with: { player: true },
			}),
			db.query.teamsUsers.findFirst({
				where: (teamsUsers, { and, eq }) =>
					and(
						eq(teamsUsers.teamId, Number(teamId)),
						eq(teamsUsers.userId, targetUserId)
					),
			}),
		])

		if (!acceptedInvites.some((ai) => ai.player.teamId === Number(teamId))) {
			throw new Response('User is not on this team', { status: 400 })
		}

		if (existingAdmin) {
			return null
		}

		await db.insert(teamsUsers).values({
			teamId: Number(teamId),
			userId: targetUserId,
		})

		return null
	}

	// delete: the owner is always an admin, and admins can't remove themselves
	const team = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.id, Number(teamId)),
	})

	invariant(team, 'Team not found')

	if (targetUserId === team.ownerId) {
		throw new Response("The team owner can't be removed as admin", {
			status: 403,
		})
	}

	if (targetUserId === user.id) {
		throw new Response("You can't remove yourself as admin", { status: 403 })
	}

	await db
		.delete(teamsUsers)
		.where(
			and(
				eq(teamsUsers.teamId, Number(teamId)),
				eq(teamsUsers.userId, targetUserId)
			)
		)

	return null
}
