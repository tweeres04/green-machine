import {
	ActionFunction,
	redirect,
	json,
	LoaderFunctionArgs,
} from '@remix-run/node'
import { useLoaderData, Form, useSearchParams, Link } from '@remix-run/react'
import { getDb } from '~/lib/getDb'
import {
	userInviteRequests,
	userInvites,
	players as playersTable,
} from '~/schema'
import invariant from 'tiny-invariant'
import {
	Select,
	SelectTrigger,
	SelectContent,
	SelectItem,
} from '~/components/ui/select'
import { Button } from '~/components/ui/button'
import { SelectValue } from '@radix-ui/react-select'
import Nav from '~/components/ui/nav'
import { formatISO } from 'date-fns'
import { eq } from 'drizzle-orm'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import Mailgun from 'mailgun.js'

async function sendInviteRequestAcceptedEmail({
	teamId,
	email,
}: {
	teamId: number
	email: string
}) {
	invariant(process.env.MAILGUN_API_KEY, 'No MAILGUN_API_KEY')
	invariant(process.env.MAILGUN_DOMAIN, 'No MAILGUN_DOMAIN')
	invariant(process.env.BASE_URL, 'No BASE_URL')

	const db = getDb()

	const teamRecord = await db.query.teams.findFirst({
		where: (teams, { eq }) => eq(teams.id, teamId),
		columns: {
			name: true,
			slug: true,
		},
	})

	invariant(teamRecord, 'Team not found')

	const teamName = teamRecord.name

	const mailgun = new Mailgun(FormData)
	const mg = mailgun.client({
		username: 'api',
		key: process.env.MAILGUN_API_KEY,
	})

	return mg.messages.create(process.env.MAILGUN_DOMAIN, {
		from: 'TeamStats Invite Request <invite_requests@teamstats.tweeres.com>',
		to: email,
		subject: `TeamStats - Your request to join ${teamName} has been accepted!`,
		text: `Check out stats here: ${process.env.BASE_URL}/${teamRecord.slug}
		
Check out games here: ${process.env.BASE_URL}/${teamRecord.slug}/games`,
	})
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const db = getDb()
	const inviteRequestId = Number(params.inviteId)

	const [inviteRequest, user] = await Promise.all([
		db.query.userInviteRequests.findFirst({
			where: (userInviteRequests, { eq }) =>
				eq(userInviteRequests.id, inviteRequestId),
			with: {
				user: true,
				team: {
					with: {
						players: {
							where: (players, { eq, and, isNotNull, notInArray }) => {
								const playersWithoutAcceptedInvite = db
									.select({ id: playersTable.id })
									.from(playersTable)
									.innerJoin(
										userInvites,
										and(
											eq(playersTable.id, userInvites.playerId),
											isNotNull(userInvites.acceptedAt)
										)
									)

								return notInArray(players.id, playersWithoutAcceptedInvite)
							},
						},
					},
				},
			},
		}),
		authenticator.isAuthenticated(request),
	])

	invariant(inviteRequest, 'Invite request not found')

	const userHasAccessToTeam = await hasAccessToTeam(user, inviteRequest.teamId)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 401 })
	}

	return json({ inviteRequest })
}

export const action: ActionFunction = async ({ request, params }) => {
	const formData = await request.formData()
	const playerId = Number(formData.get('playerId'))
	const inviteRequestId = Number(params.inviteId)

	const user = await authenticator.isAuthenticated(request)

	invariant(user, 'No user')

	const db = getDb()

	const userInviteRequest = await db.query.userInviteRequests.findFirst({
		where: (userInviteRequests, { eq }) =>
			eq(userInviteRequests.id, inviteRequestId),
		with: { user: true, team: true },
	})

	if (!userInviteRequest) {
		throw new Response('Invite request not found', { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(
		user,
		userInviteRequest.teamId
	)

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 401 })
	}

	const team = await db.transaction(async (tx) => {
		await tx
			.update(userInviteRequests)
			.set({ acceptedAt: formatISO(new Date()) })
			.where(eq(userInviteRequests.id, inviteRequestId))

		await tx.insert(userInvites).values({
			userId: userInviteRequest.userId,
			acceptedAt: formatISO(new Date()),
			createdAt: formatISO(new Date()),
			playerId: playerId,
			email: userInviteRequest.user.email,
			token: userInviteRequest.token,
			inviterId: user.id,
		})

		return userInviteRequest.team
	})

	sendInviteRequestAcceptedEmail({
		teamId: team.id,
		email: user.email,
	})

	const newUrl = new URL(request.url)
	newUrl.searchParams.set('success', 'true')

	return redirect(newUrl.toString())
}

export default function AcceptInvite() {
	const { inviteRequest } = useLoaderData<typeof loader>()
	const [searchParams] = useSearchParams()
	const success = searchParams.get('success')

	return (
		<>
			<Nav title="Accept Invite Request" />
			{success ? (
				<>
					<h1>
						Invite Request from {inviteRequest.user.name} (
						{inviteRequest.user.email}) accepted!
					</h1>
					<Button asChild>
						<Link to="/">Go home</Link>
					</Button>
				</>
			) : (
				<>
					<h1>
						Accept Invite Request from {inviteRequest.user.name} (
						{inviteRequest.user.email})
					</h1>
					<Form method="post" className="space-y-1">
						<label htmlFor="player_select">Who is this player?</label>
						<Select name="playerId" required>
							<SelectTrigger id="player_select">
								<SelectValue placeholder="Select a player" />
							</SelectTrigger>
							<SelectContent>
								{inviteRequest.team.players.map((player) => (
									<SelectItem key={player.id} value={player.id.toString()}>
										{player.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button type="submit">Accept Invite</Button>
					</Form>
				</>
			)}
		</>
	)
}
