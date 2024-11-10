import { Readable } from 'node:stream'
import {
	ActionFunctionArgs,
	unstable_parseMultipartFormData,
} from '@remix-run/node'

import * as Minio from 'minio'
import invariant from 'tiny-invariant'
import { getDb } from '~/lib/getDb'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'

invariant(process.env.MINIO_ACCESS_KEY, 'Missing MINIO_ACCESS_KEY')
invariant(process.env.MINIO_SECRET_KEY, 'Missing MINIO_SECRET_KEY')

const minioClient = new Minio.Client({
	endPoint: 'files.tweeres.com',
	useSSL: true,
	accessKey: process.env.MINIO_ACCESS_KEY,
	secretKey: process.env.MINIO_SECRET_KEY,
})

async function handlePost(request: Request, playerId: number) {
	try {
		await unstable_parseMultipartFormData(
			request,
			async ({ data, filename, contentType }) => {
				await minioClient.putObject(
					'teamstats',
					`players/${playerId}/image`,
					Readable.from(data),
					undefined,
					{ filename, 'Content-Type': contentType }
				)

				return null
			}
		)
	} catch (err) {
		if (err instanceof Error) {
			throw new Response(err.message, { status: 500 })
		}
		throw err
	}

	return null
}

export async function action({ params, request }: ActionFunctionArgs) {
	const { playerId } = params

	invariant(playerId, 'Missing playerId parameter')

	const db = getDb()

	const [user, player] = await Promise.all([
		authenticator.isAuthenticated(request),
		db.query.players.findFirst({
			columns: {
				id: true,
				teamId: true,
			},
			where: (players, { eq }) => eq(players.id, Number(playerId)),
		}),
	])

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	if (!player) {
		throw new Response('Player not found', { status: 404 })
	}

	const userHasAccessToTeam = await hasAccessToTeam(user, Number(player.teamId))

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	// native web forms don't support put
	if (request.method.toLowerCase() === 'post') {
		return handlePost(request, Number(playerId))
	}

	if (request.method.toLowerCase() === 'delete') {
		await minioClient.removeObject('teamstats', `players/${playerId}/image`)
		return new Response(null, { status: 204 })
	}
}
