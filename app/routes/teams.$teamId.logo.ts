import { Readable } from 'node:stream'
import {
	ActionFunctionArgs,
	redirect,
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

async function handlePost(
	request: Request,
	team: { id: number; slug: string }
) {
	try {
		await unstable_parseMultipartFormData(
			request,
			async ({ data, filename, contentType }) => {
				await minioClient.putObject(
					'teamstats',
					`teams/${team.id}/logo`,
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

	return redirect(`/${team.slug}/settings`)
}

export async function action({ params, request }: ActionFunctionArgs) {
	const { teamId } = params

	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const db = getDb()

	const [userHasAccessToTeam, team] = await Promise.all([
		hasAccessToTeam(user, Number(teamId)),
		db.query.teams.findFirst({
			columns: {
				id: true,
				slug: true,
			},
			where: (teams, { eq }) => eq(teams.id, Number(teamId)),
		}),
	])

	if (!userHasAccessToTeam) {
		throw new Response(null, { status: 403 })
	}

	if (!team) {
		throw new Response('Team not found', { status: 404 })
	}

	// native web forms don't support put
	if (request.method.toLowerCase() === 'post') {
		return handlePost(request, team)
	}

	if (request.method.toLowerCase() === 'delete') {
		await minioClient.removeObject('teamstats', `teams/${team.id}/logo`)
		return new Response(null, { status: 204 })
	}
}
