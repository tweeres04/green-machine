import { createContext } from 'react'
import { User } from '~/schema'

export const UserContext = createContext<{
	user: User
	userHasAccessToTeam: boolean
} | null>(null)
