import { ActionFunction, json } from '@remix-run/node'
import { authenticator, hasAccessToTeam } from '~/lib/auth.server'
import { getDb } from '~/lib/getDb'
import { eq } from 'drizzle-orm'
import { games } from '~/schema'
import invariant from 'tiny-invariant'

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
		invariant(process.env.GOOGLE_AI_API_KEY, 'No GOOGLE_AI_API_KEY')
		// Authenticate user
		const user = await authenticator.isAuthenticated(request)
		if (!user) {
			return json({ error: 'Not authenticated' }, { status: 401 })
		}

		const body: ParseRequest = await request.json()

		if (!body.text || !body.players || body.players.length === 0) {
			return json({ error: 'Missing required fields' }, { status: 400 })
		}

		// Validate team access via gameId
		if (!body.gameId) {
			return json({ error: 'Game ID required' }, { status: 400 })
		}

		const db = getDb()
		const game = await db.query.games.findFirst({
			where: eq(games.id, Number(body.gameId)),
			columns: { teamId: true },
		})

		if (!game || !game.teamId) {
			return json({ error: 'Invalid game' }, { status: 400 })
		}

		const userHasAccessToTeam = await hasAccessToTeam(user, game.teamId)
		if (!userHasAccessToTeam) {
			return json({ error: 'Not authorized' }, { status: 403 })
		}

		// Create whitelist of allowed player IDs for this team
		const allowedPlayerIds = new Set(body.players.map((p) => p.id))

		const playersList = body.players
			.map((p) => `${p.name} (ID: ${p.id})`)
			.join(', ')

		console.log('Parse request:', {
			teamId: game.teamId,
			userId: user?.id,
			allowedPlayerIds: Array.from(allowedPlayerIds),
			playerCount: body.players.length,
		})

		const response = await fetch(
			'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
			{
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
							content: `Parse the soccer game description and extract goals and assists. 
IMPORTANT: Pay close attention to numbers and quantities!
- "3 goals" means 3 separate goal entries for that player
- "5 goals" means 5 separate goal entries for that player  
- "2 goals and 1 assist" means 2 goal entries + 1 assist entry

Return ONLY a JSON array. Each stat item should have: playerId (number), type ("goal" or "assist"). 

Available players: ${playersList}. If a player name doesn't match exactly, try to find the closest match. If no matches found, return empty array. Only respond with JSON array, no other text.

Examples:
- "John scored 3 goals" → 3 goal entries for John
- "Conrad got 5 goals" → 5 goal entries for Conrad
- "Sarah had 2 assists" → 2 assist entries for Sarah`,
						},
						{
							role: 'user',
							content: `Game description: "${body.text}".`,
						},
					],
				}),
			}
		)

		if (response.status === 429) {
			const responseDetail = await response.json()
			console.error(responseDetail)
			return json({ error: 'Rate limit reached' }, { status: 429 })
		}

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
			parsedStats = JSON.parse(cleanedString).map(
				(s: Omit<ParsedStat, 'timestamp' | 'gameId'>) => ({
					...s,
					timestamp: body.timestamp,
					gameId: Number(body.gameId),
				})
			)

			// Validate the structure
			if (!Array.isArray(parsedStats)) {
				throw new Error('Response is not an array')
			}

			parsedStats = parsedStats.filter(
				(stat) =>
					stat.playerId &&
					(stat.type === 'goal' || stat.type === 'assist') &&
					stat.timestamp &&
					(typeof stat.gameId === 'number' || stat.gameId === null) &&
					allowedPlayerIds.has(stat.playerId)
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
