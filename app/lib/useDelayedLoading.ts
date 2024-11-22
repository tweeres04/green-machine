import React from 'react'

export function useDelayedLoading(isLoading: boolean, delay = 250) {
	const [showLoading, setShowLoading] = React.useState(false)
	const timerRef = React.useRef<NodeJS.Timeout>()

	React.useEffect(() => {
		if (isLoading) {
			timerRef.current = setTimeout(() => {
				setShowLoading(true)
			}, delay)
		} else {
			clearTimeout(timerRef.current)
			setShowLoading(false)
		}

		return () => {
			clearTimeout(timerRef.current)
		}
	}, [isLoading, delay])

	return showLoading && isLoading
}
