// Where the not-advice banner shows (D-041): everywhere but onboarding, whose
// step 3 safety notice already covers it.

export function showDisclaimerOn(pathname: string): boolean {
  return pathname !== '/welcome'
}

// ── Monthly backup note (D-050 rule 2) ──

const DAY_MS = 24 * 60 * 60 * 1000
export const BACKUP_NOTE_DAYS = 30

function olderThan(iso: string | undefined, now: Date, days: number): boolean {
  if (!iso) return true
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return true
  return now.getTime() - at > days * DAY_MS
}

/**
 * The note shows when the reminder is on (the default) and the last export is
 * missing or more than 30 days old; a dismissal hides it for 30 days.
 */
export function shouldShowBackupNote(
  settings: { backupReminder?: boolean; lastExportAt?: string; backupNoteDismissedAt?: string } | null | undefined,
  now: Date,
): boolean {
  if (settings?.backupReminder === false) return false
  if (!olderThan(settings?.lastExportAt, now, BACKUP_NOTE_DAYS)) return false
  if (settings?.backupNoteDismissedAt && !olderThan(settings.backupNoteDismissedAt, now, BACKUP_NOTE_DAYS)) return false
  return true
}
