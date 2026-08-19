import { LoaderFunctionArgs } from '@remix-run/node'
import { addHours, format } from 'date-fns'
import invariant from 'tiny-invariant'

import { getDb } from '~/lib/getDb'

// Floating local times (no timezone suffix) so the event lands at the game's
// wall clock time in whatever timezone the calendar lives in
const icsTimestampFormat = "yyyyMMdd'T'HHmmss"

// Commas and semicolons are structural in ICS text fields, and locations
// almost always contain commas
function escapeIcsText(value: string) {
	return value.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\n/g, '\\n')
}

export async function loader({ params }: LoaderFunctionArgs) {
	const { gameId } = params
	invariant(gameId, 'Missing gameId parameter')

	const db = getDb()

	const game = await db.query.games.findFirst({
		where: (games, { eq }) => eq(games.id, Number(gameId)),
		with: {
			team: true,
		},
	})

	if (!game || !game.timestamp) {
		throw new Response('Not found', { status: 404 })
	}

	const start = new Date(game.timestamp)
	const summary = `${game.team.name} vs ${game.opponent ?? 'TBD'}`

	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//TeamStats//EN',
		'BEGIN:VEVENT',
		`UID:game-${game.id}@teamstats.tweeres.com`,
		`DTSTAMP:${new Date()
			.toISOString()
			.replace(/[-:]/g, '')
			.replace(/\.\d+/, '')}`,
		`DTSTART:${format(start, icsTimestampFormat)}`,
		`DTEND:${format(addHours(start, 1), icsTimestampFormat)}`,
		`SUMMARY:${escapeIcsText(summary)}`,
		...(game.location ? [`LOCATION:${escapeIcsText(game.location)}`] : []),
		'END:VEVENT',
		'END:VCALENDAR',
	].join('\r\n')

	return new Response(ics, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': `attachment; filename="teamstats-game-${game.id}.ics"`,
		},
	})
}
