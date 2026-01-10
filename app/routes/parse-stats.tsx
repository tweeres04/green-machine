import { ActionFunction, json } from '@remix-run/node'

interface Player {
	id: number
	name: string
}

interface ParseRequest {
	text: string
	players: Player[]
	gameId: string | null
	timestamp: string
}

interface ParsedStat {
	playerId: number
	timestamp: string
	type: 'goal' | 'assist'
	gameId: number | null
}

export const action: ActionFunction = async ({ request }) => {
	try {
		const body: ParseRequest = await request.json()
		
		if (!body.text || !body.players || body.players.length === 0) {
			return json({ error: 'Missing required fields' }, { status: 400 })
		}

		const playersList = body.players.map(p => `${p.name} (ID: ${p.id})`).join(', ')
		
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
						content: `Parse the soccer game description and extract goals and assists. Return ONLY a JSON array. Each item should have: playerId (number), type ("goal" or "assist"), timestamp (use provided timestamp), gameId (use provided gameId or null). Available players: ${playersList}. If a player name doesn't match exactly, try to find the closest match. If no matches found, return empty array. Only respond with JSON array, no other text.`,
					},
					{
						role: 'user',
						content: `Game description: "${body.text}". Game ID: ${body.gameId}. Timestamp: ${body.timestamp}`,
					},
				],
			}),
		})

		const data = await response.json()
		
		if (!data.choices || !data.choices[0] || !data.choices[0].message) {
			return json({ error: 'Failed to parse text' }, { status: 500 })
		}

		const cleanedString = data.choices[0].message.content
			.replace(/^```json\n/, '')
			.replace(/```$/, '')
			.trim()

		let parsedStats: ParsedStat[]

		try {
			parsedStats = JSON.parse(cleanedString)
			
			// Validate the structure
			if (!Array.isArray(parsedStats)) {
				throw new Error('Response is not an array')
			}
			
			// Validate each stat entry
			parsedStats = parsedStats.filter(stat => 
				stat.playerId && 
				(stat.type === 'goal' || stat.type === 'assist') &&
				stat.timestamp &&
				typeof stat.gameId === 'number' || stat.gameId === null
			)
			
		} catch (e) {
			console.error('Failed to parse AI response:', e, cleanedString)
			return json({ error: 'Failed to parse AI response' }, { status: 500 })
		}

		return json(parsedStats)
		
	} catch (error) {
		console.error('Parse stats error:', error)
		return json({ error: 'Internal server error' }, { status: 500 })
	}
}