// Applies the Appearance setting to the page (D-039, EXEC-07.1 task 4).
// IndexedDB holds the setting; localStorage only mirrors it so the inline
// script in index.html can colour the first paint before IndexedDB answers.

import { getSettings } from '../db/index.ts'
import type { Appearance } from '../types/stores.ts'
import { appearanceOf, effectiveTheme } from './defaults.ts'

export const APPEARANCE_KEY = 'byob-appearance'
const GROUND = { light: '#f5f2ec', dark: '#171512' } as const

let current: Appearance = 'system'
let media: MediaQueryList | null = null

/** The browser's theme-color follows the colours actually in use. */
function syncThemeColor() {
  const theme = effectiveTheme(current, media?.matches ?? false)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', GROUND[theme])
}

/** Set or clear the override on <html> and mirror it for the next load. */
export function applyAppearance(appearance: Appearance): void {
  current = appearance
  const root = document.documentElement
  if (appearance === 'system') delete root.dataset.theme
  else root.dataset.theme = appearance
  try {
    localStorage.setItem(APPEARANCE_KEY, appearance)
  } catch {
    // Storage blocked: the first paint may follow the phone until IndexedDB answers.
  }
  syncThemeColor()
}

/**
 * On start: follow the phone's live changes (the CSS does the colours; this
 * keeps theme-color in step), then apply the stored setting.
 */
export function startAppearance(): void {
  media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', syncThemeColor)
  const early = document.documentElement.dataset.theme
  current = early === 'light' || early === 'dark' ? early : 'system'
  syncThemeColor()
  void getSettings().then(
    (settings) => applyAppearance(appearanceOf(settings)),
    () => undefined,
  )
}
