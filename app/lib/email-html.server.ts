// User-facing emails send html alongside the plain-text fallback so
// Mailgun's link tracking hides behind anchor text instead of showing raw
// rewritten urls
export function emailHtml(bodyHtml: string) {
	return `<div style="font-family: sans-serif;">${bodyHtml}</div>`
}

// Names and team names are user input landing in markup
export function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}
