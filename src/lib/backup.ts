// Export and import of everything on the device (D-017, EXEC-04 task 8).
// The API key is deliberately never written to an export.

import { readAllStores, replaceAllStores } from '../db/index.ts'
import type { Program } from '../types/program.ts'
import type {
  MealDay,
  Profile,
  Reprogram,
  Session,
  Settings,
  WeekPlan,
} from '../types/stores.ts'

export interface BackupFile {
  app: 'BYOB-fit'
  backupVersion: 1
  exportedAt: string
  programs: Program[]
  sessions: Session[]
  weekPlans: WeekPlan[]
  meals: MealDay[]
  profile: Profile | null
  /** Never carries apiKey. */
  settings: Settings | null
  reprograms: Reprogram[]
  meta: Record<string, string>
}

export async function buildBackup(): Promise<BackupFile> {
  const data = await readAllStores()
  const settings = data.settings ? { ...data.settings } : null
  if (settings) delete settings.apiKey
  return {
    app: 'BYOB-fit',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    ...data,
    settings,
  }
}

export type BackupResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; errors: string[] }

export function validateBackup(value: unknown): BackupResult {
  const errors: string[] = []
  const backup = value as Partial<BackupFile>
  if (typeof backup !== 'object' || backup === null) {
    return { ok: false, errors: ['/: the file is not a JSON object'] }
  }
  if (backup.app !== 'BYOB-fit') {
    errors.push('/app: must be "BYOB-fit" — this is not a BYOB-fit export')
  }
  if (backup.backupVersion !== 1) {
    errors.push(`/backupVersion: must be 1, got ${JSON.stringify(backup.backupVersion)}`)
  }
  for (const key of [
    'programs',
    'sessions',
    'weekPlans',
    'meals',
    'reprograms',
  ] as const) {
    if (!Array.isArray(backup[key])) errors.push(`/${key}: must be an array`)
  }
  if (backup.meta !== undefined && typeof backup.meta !== 'object') {
    errors.push('/meta: must be an object')
  }
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    backup: {
      app: 'BYOB-fit',
      backupVersion: 1,
      exportedAt: backup.exportedAt ?? new Date().toISOString(),
      programs: backup.programs ?? [],
      sessions: backup.sessions ?? [],
      weekPlans: backup.weekPlans ?? [],
      meals: backup.meals ?? [],
      profile: backup.profile ?? null,
      settings: backup.settings ?? null,
      reprograms: backup.reprograms ?? [],
      meta: backup.meta ?? {},
    },
  }
}

export async function restoreBackup(backup: BackupFile): Promise<void> {
  await replaceAllStores({
    programs: backup.programs,
    sessions: backup.sessions,
    weekPlans: backup.weekPlans,
    meals: backup.meals,
    profile: backup.profile,
    settings: backup.settings,
    reprograms: backup.reprograms,
    meta: backup.meta,
  })
}

export function backupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  return `byob-fit-${stamp}.json`
}

/**
 * Share sheet where the browser offers one, otherwise a download. Returns how
 * it was delivered so the screen can say so.
 */
export async function deliverBackup(
  backup: BackupFile,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const text = JSON.stringify(backup, null, 2)
  const name = backupFilename()
  const file = new File([text], name, { type: 'application/json' })

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: 'BYOB-fit export' })
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled'
      // Fall through to a download.
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
