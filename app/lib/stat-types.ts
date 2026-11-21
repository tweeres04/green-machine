// Award stats: a game can have at most one of each, enforced in the /stats
// action and reflected in the add-stats dialog UI
export const oncePerGameStatTypes = ['mvp', 'clean_sheet'] as const

// Teams pick their assist emoji in settings. 🍎 is hockey slang ("apples"),
// which not every team gets
export const assistEmojiOptions = [
	{ emoji: '🍎', label: 'Apple' },
	{ emoji: '🎯', label: 'Dart' },
	{ emoji: '🤝', label: 'Handshake' },
	{ emoji: '🎁', label: 'Gift' },
	{ emoji: '🅰️', label: 'A for assist' },
]

// Every team has its own MVP symbol, so this list runs longer
export const mvpEmojiOptions = [
	{ emoji: '🏆', label: 'Trophy' },
	{ emoji: '🏅', label: 'Medal' },
	{ emoji: '👑', label: 'Crown' },
	{ emoji: '⭐', label: 'Star' },
	{ emoji: '🐐', label: 'GOAT' },
	{ emoji: '🪓', label: 'Axe' },
	{ emoji: '🔨', label: 'Hammer' },
	{ emoji: '🛡️', label: 'Shield' },
	{ emoji: '⚔️', label: 'Swords' },
	{ emoji: '🎩', label: 'Top hat' },
	{ emoji: '🦆', label: 'Duck' },
]

export function getStatEmoji({
	assistEmoji,
	mvpEmoji,
}: {
	assistEmoji: string
	mvpEmoji: string
}): Record<string, string> {
	return {
		goal: '⚽️',
		assist: assistEmoji,
		mvp: mvpEmoji,
		clean_sheet: '🧤',
	}
}

// Natural-language names for popovers and dialog titles. Lowercase where the
// word is a common noun; use lodash upperFirst when starting a sentence
// (capitalize would lowercase the rest of "MVP")
export const statLabel: Record<string, string> = {
	goal: 'goal',
	assist: 'assist',
	mvp: 'MVP',
	clean_sheet: 'clean sheet',
}
