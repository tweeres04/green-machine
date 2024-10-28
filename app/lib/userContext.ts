import { createContext } from 'react'
import { User } from '~/schema'

export const UserContext = createContext<User | null>(null)
