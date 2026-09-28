// Export and import of everything on the device (D-017, EXEC-04 task 8,
// EXEC-05 task 6, EXEC-06 task 8). The API key is deliberately never written
// to an export.

import { readAllStores, replaceAllStores } from '../db/index.ts'
import type { Program } from '../types/program.ts'
import type {
  Goals,
  MealDay,
  Profile,
  Reprogram,
  SentLogEntry,
  Session,
  Settings,
  WeekPlan,
} from '../types/stores.ts'
import { upgradeProgram } from './program.ts'
import { withoutDeviceStorage } from './storage.ts'

/** The envelope version this build writes (PLAN v1.5 section 5). */
export const BACKUP_SCHEMA_VERSION = 2

/** Every envelope version this build reads. Anything else is refused. */
const READABLE_VERSIONS = [1, 2]

export interface BackupFile {
  app: 'BYOB-fit'
  schemaVersion: typeof BACKUP_SCHEMA_VERSION
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
  goals: Goals | null
  sentLog: SentLogEntry[]
}

type StoreData = Awaited<ReturnType<typeof readAllStores>>

/** Build the envelope from store contents. Pure, so it can be tested. */
export function backupFromData(data: StoreData, now = new Date()): BackupFile {
  const settings = data.settings ? withoutDeviceStorage(data.settings) : null
  if (settings) delete settings.apiKey
  return {
    app: 'BYOB-fit',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    ...data,
    settings,
  }
}

export async function buildBackup(): Promise<BackupFile> {
  return backupFromData(await readAllStores())
}

export type BackupResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; errors: string[] }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Check the envelope before anything touches a store. Versions 1 and 2 are
 * read; a version 1 file comes back as version 2 with no goals and an empty
 * sent log. An unknown or missing schemaVersion is refused, never guessed at.
 */
export function validateBackup(value: unknown): BackupResult {
  if (!isObject(value)) {
    return { ok: false, errors: ['/: the file is not a JSON object'] }
  }
  if (value.app !== 'BYOB-fit') {
    return {
      ok: false,
      errors: ['/app: must be "BYOB-fit". This is not a BYOB-fit export'],
    }
  }
  if (value.schemaVersion === undefined) {
    return {
      ok: false,
      errors: [
        '/schemaVersion: missing. This export was not written by a version of BYOB-fit this build can read, so nothing was imported',
      ],
    }
  }
  if (!READABLE_VERSIONS.includes(value.schemaVersion as number)) {
    return {
      ok: false,
      errors: [
        `/schemaVersion: this build reads versions ${READABLE_VERSIONS.join(' and ')}, the file says ${JSON.stringify(value.schemaVersion)}. Nothing was imported`,
      ],
    }
  }
  const version = value.schemaVersion as 1 | 2

  const errors: string[] = []
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    errors.push('/exportedAt: must be an ISO date-time string')
  }
  for (const key of [
    'programs',
    'sessions',
    'weekPlans',
    'meals',
    'reprograms',
  ] as const) {
    if (!Array.isArray(value[key])) errors.push(`/${key}: must be an array`)
  }
  for (const key of ['profile', 'settings'] as const) {
    if (value[key] !== null && !isObject(value[key])) {
      errors.push(`/${key}: must be an object or null`)
    }
  }
  if (!isObject(value.meta)) errors.push('/meta: must be an object')
  if (version === 2) {
    if (value.goals !== null && !isObject(value.goals)) {
      errors.push('/goals: must be an object or null')
    }
    if (!Array.isArray(value.sentLog)) errors.push('/sentLog: must be an array')
  }
  if (errors.length > 0) return { ok: false, errors }

  const backup = value as unknown as BackupFile
  return {
    ok: true,
    backup: {
      app: 'BYOB-fit',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: backup.exportedAt,
      programs: backup.programs,
      sessions: backup.sessions,
      weekPlans: backup.weekPlans,
      meals: backup.meals,
      profile: backup.profile,
      settings: backup.settings,
      reprograms: backup.reprograms,
      meta: backup.meta,
      goals: version === 2 ? backup.goals : null,
      sentLog: version === 2 ? backup.sentLog : [],
    },
  }
}

/** Parse the text of an export file, then validate the envelope. */
export function parseBackup(text: string): BackupResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      errors: [`/: the file is not valid JSON (${(error as Error).message})`],
    }
  }
  return validateBackup(parsed)
}

export async function restoreBackup(backup: BackupFile): Promise<void> {
  await replaceAllStores({
    // Stored programs are always schema version 2 (D-035).
    programs: backup.programs.map(upgradeProgram),
    sessions: backup.sessions,
    weekPlans: backup.weekPlans,
    meals: backup.meals,
    profile: backup.profile,
    // Device-specific storage fields never cross devices.
    settings: backup.settings ? withoutDeviceStorage(backup.settings) : null,
    reprograms: backup.reprograms,
    meta: backup.meta,
    goals: backup.goals,
    sentLog: backup.sentLog,
  })
}

export function backupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  return `byob-fit-export-${stamp}.json`
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
