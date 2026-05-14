import { ActionFunction, json } from '@remix-run/node'

export const action: ActionFunction = async ({ request }) => {
	const formData = await request.formData()
	const scheduleUrl = formData.get('schedule_url')
	const pastedSchedule = formData.get('schedule_text')
	const teamName = formData.get('team_name')

	if (!teamName || (!scheduleUrl && !pastedSchedule)) {
		return new Response(null, { status: 400 })
	}

	const scheduleContent = scheduleUrl
		? await fetch(scheduleUrl as string).then((r) => r.text())
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
