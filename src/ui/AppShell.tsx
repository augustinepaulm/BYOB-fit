import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

import { InProgressBar } from './InProgressBar.tsx'
import { TabBar } from './TabBar.tsx'
import { isTypingTarget } from './tabs.ts'

/**
 * D-077 rule 2: while a text or number field has focus the keyboard is open,
 * and the tab bar and the in-progress bar step aside. The flag lives on <html>
 * so the CSS can hide both.
 */
function useKeyboardFlag() {
  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      if (isTypingTarget(document.activeElement as HTMLElement | null)) root.dataset.keyboard = 'open'
      else delete root.dataset.keyboard
    }
    // focusout fires before the next element takes focus; check once it has.
    const later = () => window.setTimeout(sync, 0)
    document.addEventListener('focusin', sync)
    document.addEventListener('focusout', later)
    return () => {
      document.removeEventListener('focusin', sync)
      document.removeEventListener('focusout', later)
      delete root.dataset.keyboard
    }
  }, [])
}

/** Every screen inside the app: the tabs show throughout, the deck included (D-077, D-083 rule 6). */
export function TabbedLayout() {
  useKeyboardFlag()
  return (
    <div className="app app--tabbed">
      <Outlet />
      <InProgressBar />
      <TabBar />
    </div>
  )
}

/**
 * Full-screen flows with their own Back and Save, shown without the tab bar
 * (D-083 rule 6): onboarding, import and the builder.
 */
export function PlainLayout() {
  return (
    <div className="app">
      <Outlet />
    </div>
  )
}
