// App-wide notices above every screen (EXEC-05 tasks 4 and 9): the update
// banner, the one-time offline-ready toast, and the per-load disclaimer; and
// the offline bar from frame 7a (EXEC-11 task 9).

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { useOnline } from '../ai/usePreview.tsx'
import { showDisclaimerOn } from '../lib/notices.ts'

const DISCLAIMER =
  'This app and its AI features are not medical, dietary or training advice. Verify changes with a qualified professional.'

const TOAST_MS = 4000

function OfflineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18" />
    </svg>
  )
}

/** Frame 7a: shows on every screen while offline. Logging still works. */
export function OfflineBar() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="st-offline" role="status">
      <OfflineIcon />
      <span>You're offline. Logging works; AI features need a connection.</span>
    </div>
  )
}

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
  const { pathname } = useLocation()
  const disclaimer = !disclaimerDismissed && showDisclaimerOn(pathname)

  // onOfflineReady fires once, when the first worker finishes precaching.
  useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(() => setOfflineReady(false), TOAST_MS)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  const notices = (disclaimer || needRefresh || offlineReady) && (
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
      {disclaimer && (
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

  return (
    <>
      <OfflineBar />
      {notices}
    </>
  )
}
