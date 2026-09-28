// Defaults for Settings fields that older records lack (PLAN v1.5 section 5).
// Every reader goes through these, so a missing value always means the same.

import type { LoadUnit } from '../types/program.ts'
import type { Appearance, PrivacyLevel, Settings } from '../types/stores.ts'

/** Display unit; kg when unset, which is how the app behaved before v1.5. */
export function unitsOf(settings: Settings | null | undefined): LoadUnit {
  return settings?.units ?? 'kg'
}

/** Privacy level for model calls; minimal when unset (D-031). */
export function privacyLevelOf(settings: Settings | null | undefined): PrivacyLevel {
  return settings?.privacyLevel ?? 'minimal'
}

/** Appearance; system when unset, which is how the app behaved before D-039. */
export function appearanceOf(settings: Settings | null | undefined): Appearance {
  return settings?.appearance ?? 'system'
}

/** The colours in use: an override wins, System follows the phone. */
export function effectiveTheme(
  appearance: Appearance,
  systemPrefersDark: boolean,
): 'light' | 'dark' {
  if (appearance === 'system') return systemPrefersDark ? 'dark' : 'light'
  return appearance
}
