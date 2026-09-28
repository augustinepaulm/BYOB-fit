// App-wide notices above every screen (EXEC-05 tasks 4 and 9): the update
// banner, the one-time offline-ready toast, and the per-load disclaimer.

import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const DISCLAIMER =
  'This app and its AI features are not medical, dietary or training advice. Verify changes with a qualified professional.'

const TOAST_MS = 4000

export function AppNotices() {
  // registerType 'prompt': a waiting worker only takes over when the user taps
  // Reload, so the deck never reloads on its own.
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  // In memory only: a full app load starts with the disclaimer showing again.
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false)

  // onOfflineReady fires once, when the first worker finishes precaching.
  useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(() => setOfflineReady(false), TOAST_MS)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (disclaimerDismissed && !needRefresh && !offlineReady) return null

  return (
    <div className="app-notices">
      {needRefresh && (
        <div className="banner" role="status">
          <span className="banner__text">Update available</span>
          <button
            type="button"
            className="banner__action"
            onClick={() => void updateServiceWorker(true)}
          >
            Reload
          </button>
          <button
            type="button"
            className="banner__close"
            aria-label="Dismiss"
            onClick={() => setNeedRefresh(false)}
          >
            ×
          </button>
        </div>
      )}
      {offlineReady && (
        <div className="banner" role="status">
          <span className="banner__text">Ready to work offline</span>
        </div>
      )}
      {!disclaimerDismissed && (
        <div className="banner" role="note">
          <span className="banner__text">{DISCLAIMER}</span>
          <button
            type="button"
            className="banner__close"
            aria-label="Dismiss"
            onClick={() => setDisclaimerDismissed(true)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
