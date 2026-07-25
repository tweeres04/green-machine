import { createHash } from 'node:crypto'

// Social platforms cache og images by URL, so the og:image URL carries a hash
// of what the image renders. The URL only changes when the image content
// changes, which busts platform image caches on their next scrape.
export function ogImageVersion(input: unknown) {
	return createHash('sha1')
		.update(JSON.stringify(input))
		.digest('hex')
		.slice(0, 8)
}
