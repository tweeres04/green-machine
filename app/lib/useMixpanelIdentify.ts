import mixpanel from 'mixpanel-browser'
import { useEffect } from 'react'
import { User } from '~/schema'

export function useMixpanelIdentify(user: User | null) {
	useEffect(() => {
		if (user) {
			mixpanel.identify(user.id.toString())
			mixpanel.people.set({
				$name: user.name,
				$email: user.email,
			})
		}
	}, [user])
}
