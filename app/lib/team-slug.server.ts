import { redirect } from '@remix-run/node'
import { sql } from 'drizzle-orm'
import { teams } from '~/schema'

// Slugs match case-insensitively, so /ycd-fc finds YCD-FC. Done here rather
// than with COLLATE NOCASE on the column because drizzle can't express
// collation, which would leave it as hand-written SQL its snapshots don't know
// about, silently lost the first time a migration rebuilt the table
export function slugEquals(slug: string) {
	return sql`lower(${teams.slug}) = ${slug.toLowerCase()}`
}

// The stored casing is the canonical URL, so a request in any other casing
// redirects to it. Keeps one team to one address without renaming the two
// teams that already have capitals in their slug
export function requireCanonicalSlug(
	request: Request,
	requestedSlug: string,
	storedSlug: string
) {
	if (requestedSlug === storedSlug) {
		return
	}

	const url = new URL(request.url)
	const segments = url.pathname.split('/')

	// The slug is always the first segment, so don't touch anything later that
	// happens to look the same
	segments[1] = storedSlug
	url.pathname = segments.join('/')

	throw redirect(url.toString(), { status: 301 })
}
