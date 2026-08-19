import { useEffect, useState, useSyncExternalStore } from 'react'
import { HousePlus, X } from 'lucide-react'
import mixpanel from 'mixpanel-browser'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { IosShareIcon } from '~/components/ui/ios-share-icon'
import {
	getInstallPrompt,
	subscribeToInstallPrompt,
} from '~/lib/install-prompt'

// Dismissing snoozes rather than hides forever: visits cluster around game
// day, so a week reads as about once per game week
const snoozedAtKey = 'addToHomeScreenSnoozedAt'
const snoozeMs = 7 * 24 * 60 * 60 * 1000

export function AddToHomeScreenCard() {
	const installPrompt = useSyncExternalStore(
		subscribeToInstallPrompt,
		getInstallPrompt,
		() => null
	)
	const [dismissed, setDismissed] = useState(false)
	// Standalone and localStorage checks are client-only, so they wait for an
	// effect to avoid a hydration mismatch. Until then the card renders nothing
	const [environment, setEnvironment] = useState<{
		isIos: boolean
		hidden: boolean
	} | null>(null)

	useEffect(() => {
		setEnvironment({
			isIos: /iPad|iPhone|iPod/.test(navigator.userAgent),
			hidden:
				window.matchMedia('(display-mode: standalone)').matches ||
				Date.now() - Number(localStorage.getItem(snoozedAtKey)) < snoozeMs,
		})
	}, [])

	if (!environment || environment.hidden || dismissed) {
		return null
	}

	// iOS has no install prompt API, so it gets instructions instead of a
	// button. Everything else without a captured prompt (already installed,
	// desktop Safari, Firefox) gets nothing
	if (!installPrompt && !environment.isIos) {
		return null
	}

	return (
		<Alert>
			<AlertDescription className="space-y-3">
				<div className="flex items-start gap-2">
					<p className="grow">
						Add TeamStats to your home screen for one tap access to your stats.
					</p>
					<Button
						size="icon"
						variant="ghost"
						aria-label="Dismiss"
						className="-mt-2 -mr-2 shrink-0"
						onClick={() => {
							localStorage.setItem(snoozedAtKey, Date.now().toString())
							setDismissed(true)
							mixpanel.track('dismiss add to home screen')
						}}
					>
						<X className="size-4" />
					</Button>
				</div>
				{installPrompt ? (
					<Button
						variant="secondary"
						onClick={() => {
							installPrompt.prompt()
							installPrompt.userChoice.then(({ outcome }) => {
								mixpanel.track('click add to home screen', { outcome })
								// Declining the native prompt snoozes like the X does.
								// Accepting needs nothing: Chromium stops firing
								// beforeinstallprompt once the app is installed
								if (outcome === 'dismissed') {
									localStorage.setItem(snoozedAtKey, Date.now().toString())
								}
								// Either way the captured prompt is spent, so the button
								// can't be clicked again this visit
								setDismissed(true)
							})
						}}
					>
						<HousePlus />
						Add to home screen
					</Button>
				) : (
					<div className="space-y-1 text-sm">
						<p>
							<span className="font-medium">1.</span> Tap the share button{' '}
							<IosShareIcon className="inline" /> at the bottom of Safari
						</p>
						<p>
							<span className="font-medium">2.</span> Tap &ldquo;Add to Home
							Screen&rdquo;
						</p>
					</div>
				)}
			</AlertDescription>
		</Alert>
	)
}
