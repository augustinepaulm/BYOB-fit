// IndexedDB schema for BYOB-fit. All data stays on the device; nothing here
// touches localStorage or sessionStorage.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import { dayChangesFromWeekPlans, type LegacyWeekPlan } from '../lib/dayChanges.ts'
import { upgradeProgram } from '../lib/program.ts'
import type { Program } from '../types/program.ts'
import type {
  DayChange,
  Goals,
  MealDay,
  Profile,
  Reprogram,
  SentLogEntry,
  Session,
  Settings,
} from '../types/stores.ts'

export const DB_NAME = 'byob-fit'
export const DB_VERSION = 4

/** The single record keys for the one-row stores. */
export const PROFILE_KEY = 'me'
export const GOALS_KEY = 'me'
export const SETTINGS_KEY = 'app'
export const ACTIVE_PROGRAM_KEY = 'activeProgramId'

export interface ByobDB extends DBSchema {
  programs: { key: string; value: Program }
  sessions: {
    key: string
    value: Session
    indexes: { date: string; dayId: string }
  }
  /** D-069: one record per changed date, keyed by date. Replaced weekPlans at version 4. */
  dayChanges: { key: string; value: DayChange }
  profile: { key: string; value: Profile }
  meals: { key: string; value: MealDay }
  settings: { key: string; value: Settings }
  reprograms: { key: string; value: Reprogram; indexes: { week: number } }
  meta: { key: string; value: string }
  goals: { key: string; value: Goals }
  sentLog: { key: string; value: SentLogEntry; indexes: { at: string } }
}

let dbPromise: Promise<IDBPDatabase<ByobDB>> | null = null

export function getDB(): Promise<IDBPDatabase<ByobDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ByobDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore('programs', { keyPath: 'id' })

          const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
          sessions.createIndex('date', 'date')
          sessions.createIndex('dayId', 'dayId')

          // Week plans existed until version 4, which converts and removes them.
          db.createObjectStore('weekPlans' as never, { keyPath: 'programWeek' })
          db.createObjectStore('meals', { keyPath: 'date' })

          // Single-record stores and the key-value store use out-of-line keys.
          db.createObjectStore('profile')
          db.createObjectStore('settings')
          db.createObjectStore('meta')
        }
        if (oldVersion < 2) {
          const reprograms = db.createObjectStore('reprograms', {
            keyPath: 'id',
          })
          reprograms.createIndex('week', 'week')
        }
        if (oldVersion < 3) {
          db.createObjectStore('goals')
          const sentLog = db.createObjectStore('sentLog', { keyPath: 'id' })
          sentLog.createIndex('at', 'at')
          // Every stored program becomes schema version 2 (D-035). The upgrade
          // transaction stays open while these requests are pending.
          void (async () => {
            let cursor = await transaction.objectStore('programs').openCursor()
            while (cursor) {
              await cursor.update(upgradeProgram(cursor.value))
              cursor = await cursor.continue()
            }
          })()
        }
        if (oldVersion < 4) {
          // D-069: weekly swap pairs become per-date day changes against the
          // active program, then the week-plan store goes. The upgrade
          // transaction stays open while these requests are pending.
          db.createObjectStore('dayChanges', { keyPath: 'date' })
          const legacy = transaction as unknown as {
            objectStore(name: string): { getAll(): Promise<unknown[]>; get(key: string): Promise<unknown> }
          }
          void (async () => {
            const plans = (await legacy.objectStore('weekPlans').getAll()) as LegacyWeekPlan[]
            const activeId = (await legacy.objectStore('meta').get(ACTIVE_PROGRAM_KEY)) as string | undefined
            const program = activeId ? ((await legacy.objectStore('programs').get(activeId)) as Program | undefined) : undefined
            const changes = dayChangesFromWeekPlans(program, plans, new Date().toISOString())
            for (const change of changes) await transaction.objectStore('dayChanges').put(change)
            db.deleteObjectStore('weekPlans' as never)
          })()
        }
      },
    })
  }
  return dbPromise
}
