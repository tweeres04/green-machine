// Only same-site paths survive, so a crafted signup or login link can't
// bounce users to another site after they authenticate
export function safeRedirect(redirectTo: FormDataEntryValue | string | null) {
	return typeof redirectTo === 'string' &&
		redirectTo.startsWith('/') &&
		!redirectTo.startsWith('//')
		? redirectTo
		: null
}
