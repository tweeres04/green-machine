// Award stats: a game can have at most one of each, enforced in the /stats
// action and reflected in the add-stats dialog UI
export const oncePerGameStatTypes = ['mvp', 'clean_sheet'] as const

export const statEmoji: Record<string, string> = {
	goal: '⚽️',
	assist: '🍎',
	mvp: '🪓',
	clean_sheet: '🧤',
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
