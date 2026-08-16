import { User } from '~/schema'

export const SUDO_DURATION_MINUTES = 15

const SUDO_DURATION_MS = SUDO_DURATION_MINUTES * 60 * 1000

// Ids rather than a flag on the user row, so the identity isn't in the repo
// and a restored database can't hand the role to whoever lands on id 1
const supportUserIds = (process.env.SUPPORT_USER_IDS ?? '')
	.split(',')
	.map((id) => Number(id.trim()))
	.filter((id) => Number.isInteger(id))

export function isSupportUser(user: User | null) {
	return user ? supportUserIds.includes(user.id) : false
}

// In memory on purpose. One container, a 15 minute window, and an elevation
// that shouldn't survive a deploy anyway. A restart drops everyone back to
// no access, which is the right way for this to fail
const elevations = new Map<number, { teamId: number; expiresAt: number }>()

export function elevate(userId: number, teamId: number) {
	const expiresAt = Date.now() + SUDO_DURATION_MS

	elevations.set(userId, { teamId, expiresAt })

	return expiresAt
}

export function elevationFor(userId: number) {
	const elevation = elevations.get(userId)

	if (!elevation) {
		return null
	}

	// Absolute expiry, so being active can't extend it
	if (elevation.expiresAt <= Date.now()) {
		elevations.delete(userId)
		return null
	}

	return elevation
}

export function isElevatedFor(user: User | null, teamId: number) {
	if (!isSupportUser(user) || !user) {
		return false
	}

	return elevationFor(user.id)?.teamId === teamId
}

export function endElevation(userId: number) {
	elevations.delete(userId)
}
