import { ActionFunction, json } from '@remix-run/node'

export const action: ActionFunction = async ({ request }) => {
	const formData = await request.formData()
	const scheduleUrl = formData.get('schedule_url')
	const teamName = formData.get('team_name')

	if (!scheduleUrl || !teamName) {
		return new Response(null, { status: 400 })
	}

	const scheduleResponse = await fetch(scheduleUrl as string)
	const scheduleHtml = await scheduleResponse.text()

	const response = await fetch('https://api.perplexity.ai/chat/completions', {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
		},
		body: JSON.stringify({
			model: 'sonar-pro',
			messages: [
				{
					role: 'system',
					content: `Extract a JSON formatted list of games from the HTML provided. Only include games for the team called ${teamName}. Include the timestamp in ISO format but without the Z character, opponent, and location. Only respond with JSON. Do not include any other enclosing text.`,
				},
				{
					role: 'user',
					content: scheduleHtml,
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
