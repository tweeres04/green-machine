import { createHash } from 'node:crypto'

const GRAPH_API_VERSION = 'v19.0'

type CapiUser = {
	id?: number | string
	email?: string | null
	name?: string | null
}

type CapiOptions = {
	request: Request
	eventName: string
	user?: CapiUser | null
	customData?: Record<string, unknown>
	eventId?: string
}

function sha256(value: string) {
	return createHash('sha256').update(value).digest('hex')
}

function hashEmail(email: string | null | undefined) {
	if (!email) return undefined
	return sha256(email.trim().toLowerCase())
}

function getCookie(cookieHeader: string | null, name: string) {
	if (!cookieHeader) return undefined
	const match = cookieHeader
		.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${name}=`))
	return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

function getClientIp(request: Request) {
	const forwarded = request.headers.get('x-forwarded-for')
	if (forwarded) {
		return forwarded.split(',')[0].trim()
	}
	return request.headers.get('x-real-ip') ?? undefined
}

export async function sendCapiEvent({
	request,
	eventName,
	user,
	customData,
	eventId,
}: CapiOptions) {
	const pixelId = process.env.FB_PIXEL_ID
	const accessToken = process.env.FB_CAPI_ACCESS_TOKEN

	if (!pixelId || !accessToken) {
		return
	}

	const cookieHeader = request.headers.get('cookie')
	const fbp = getCookie(cookieHeader, '_fbp')
	const fbc = getCookie(cookieHeader, '_fbc')

	const userData: Record<string, unknown> = {
		client_ip_address: getClientIp(request),
		client_user_agent: request.headers.get('user-agent') ?? undefined,
		fbp,
		fbc,
		em: hashEmail(user?.email),
		external_id: user?.id ? sha256(String(user.id)) : undefined,
	}

	for (const key of Object.keys(userData)) {
		if (userData[key] === undefined) delete userData[key]
	}

	const event: Record<string, unknown> = {
		event_name: eventName,
		event_time: Math.floor(Date.now() / 1000),
		action_source: 'website',
		event_source_url: request.url,
		user_data: userData,
	}

	if (eventId) event.event_id = eventId
	if (customData) event.custom_data = customData

	const body: Record<string, unknown> = {
		data: [event],
		access_token: accessToken,
	}

	if (process.env.FB_CAPI_TEST_EVENT_CODE) {
		body.test_event_code = process.env.FB_CAPI_TEST_EVENT_CODE
	}

	const response = await fetch(
		`https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		}
	)

	if (!response.ok) {
		const text = await response.text().catch(() => '')
		throw new Error(
			`Facebook CAPI ${eventName} failed: ${response.status} ${text}`
		)
	}
}
