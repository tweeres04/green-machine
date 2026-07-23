import { ActionFunction, json } from '@remix-run/node'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { authenticator } from '~/lib/auth.server'

const MAX_PASTE_BYTES = 50_000
const MAX_FETCH_BYTES = 500_000
const FETCH_TIMEOUT_MS = 15_000

function isPrivateIpv4(ip: string): boolean {
	const parts = ip.split('.').map(Number)
	if (parts.length !== 4 || parts.some(Number.isNaN)) return true
	const [a, b] = parts
	if (a === 10 || a === 127 || a === 0) return true
	if (a === 169 && b === 254) return true
	if (a === 172 && b >= 16 && b <= 31) return true
	if (a === 192 && b === 168) return true
	if (a === 100 && b >= 64 && b <= 127) return true
	return false
}

function isPrivateIp(ip: string): boolean {
	if (ip.startsWith('::ffff:')) return isPrivateIpv4(ip.slice(7))
	if (isIP(ip) === 6) {
		const lower = ip.toLowerCase()
		return lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)
	}
	return isPrivateIpv4(ip)
}

async function fetchSchedule(rawUrl: string): Promise<string> {
	const url = new URL(rawUrl)
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Response('Invalid URL', { status: 400 })
	}
	const addresses = await lookup(url.hostname, { all: true })
	if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
		throw new Response('URL not allowed', { status: 400 })
	}

	const response = await fetch(rawUrl, {
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	})
	if (!response.body) return ''

	const chunks: Uint8Array[] = []
	let bytes = 0
	for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
		bytes += chunk.length
		if (bytes > MAX_FETCH_BYTES) break
		chunks.push(chunk)
	}
	return Buffer.concat(chunks).toString('utf-8')
}

export const action: ActionFunction = async ({ request }) => {
	const user = await authenticator.isAuthenticated(request)

	if (!user) {
		throw new Response(null, { status: 401 })
	}

	const formData = await request.formData()
	const scheduleUrl = formData.get('schedule_url') as string | null
	const pastedSchedule = formData.get('schedule_text') as string | null
	const teamName = formData.get('team_name')

	if (!teamName || (!scheduleUrl && !pastedSchedule)) {
		return new Response(null, { status: 400 })
	}

	if (pastedSchedule && pastedSchedule.length > MAX_PASTE_BYTES) {
		return new Response(null, { status: 400 })
	}

	const scheduleContent = scheduleUrl
		? await fetchSchedule(scheduleUrl)
		: (pastedSchedule as string)

	const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			Authorization: `Bearer ${process.env.GOOGLE_AI_API_KEY}`,
		},
		body: JSON.stringify({
			model: 'gemini-2.5-flash-lite',
			messages: [
				{
					role: 'system',
					content: `Extract a JSON formatted list of games from the schedule provided. Only include games for the team called ${teamName}. Include the timestamp in ISO format but without the Z character, opponent, and location. Only respond with JSON. Do not include any other enclosing text.`,
				},
				{
					role: 'user',
					content: scheduleContent,
				},
			],
		}),
	})

	const data = await response.json()
	const cleanedString = data.choices[0].message.content
		.replace(/^```json\n/, '')
		.replace(/```$/, '')

	let games

	try {
		games = JSON.parse(cleanedString)
	} catch (e) {
		games = []
	}

	return json({ games })
}

export default function ImportSchedule() {
	return null
}
