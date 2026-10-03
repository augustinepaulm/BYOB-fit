// Restore from a backup file: the one import Settings and the welcome screen
// both run (D-072 rule 1, D-083 rule 3). The envelope is checked before any
// store is touched; then every store is replaced and this device's settings
// are applied.

import { parseBackup, restoreBackup, type BackupResult } from '../lib/backup.ts'
import { recordStoragePersistence } from '../lib/storage.ts'
import { applyAppearance } from './appearance.ts'
import { appearanceOf } from './defaults.ts'

/** Check a file's text without touching anything. */
export function checkBackup(text: string): BackupResult {
  return parseBackup(text)
}

/** Replace every store with a checked backup, then apply its appearance now. */
export async function restoreFromText(text: string): Promise<BackupResult> {
  const result = parseBackup(text)
  if (!result.ok) return result
  await restoreBackup(result.backup)
  // The restored appearance applies now, not at the next load (EXEC-11 task 4).
  applyAppearance(appearanceOf(result.backup.settings))
  await recordStoragePersistence()
  return result
}
