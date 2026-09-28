// Defaults for Settings fields that older records lack (PLAN v1.5 section 5).
// Every reader goes through these, so a missing value always means the same.

import type { LoadUnit } from '../types/program.ts'
import type { PrivacyLevel, Settings } from '../types/stores.ts'

/** Display unit; kg when unset, which is how the app behaved before v1.5. */
export function unitsOf(settings: Settings | null | undefined): LoadUnit {
  return settings?.units ?? 'kg'
}

/** Privacy level for model calls; minimal when unset (D-031). */
export function privacyLevelOf(settings: Settings | null | undefined): PrivacyLevel {
  return settings?.privacyLevel ?? 'minimal'
}
