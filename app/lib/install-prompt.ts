// Not in TypeScript's lib because only Chromium implements it
export interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// Chromium fires beforeinstallprompt once, often before React hydrates, so
// an effect-attached listener would miss it. Capture it at module scope and
// let components read it through useSyncExternalStore
let capturedPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', (event) => {
		// Suppresses Chrome's own mini infobar; the card is the prompt
		event.preventDefault()
		capturedPrompt = event as BeforeInstallPromptEvent
		listeners.forEach((listener) => listener())
	})
}

export function subscribeToInstallPrompt(listener: () => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export function getInstallPrompt() {
	return capturedPrompt
}
