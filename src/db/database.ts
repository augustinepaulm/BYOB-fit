// IndexedDB schema for BYOB-fit. All data stays on the device; nothing here
// touches localStorage or sessionStorage.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { Program } from '../types/program.ts'
import type {
  MealDay,
  Profile,
  Session,
  Settings,
  WeekPlan,
} from '../types/stores.ts'

export const DB_NAME = 'byob-fit'
export const DB_VERSION = 1

/** The single record keys for the one-row stores. */
export const PROFILE_KEY = 'me'
export const SETTINGS_KEY = 'app'
export const ACTIVE_PROGRAM_KEY = 'activeProgramId'

export interface ByobDB extends DBSchema {
  programs: { key: string; value: Program }
  sessions: {
    key: string
    value: Session
    indexes: { date: string; dayId: string }
  }
  weekPlans: { key: number; value: WeekPlan }
  profile: { key: string; value: Profile }
  meals: { key: string; value: MealDay }
  settings: { key: string; value: Settings }
  meta: { key: string; value: string }
}

let dbPromise: Promise<IDBPDatabase<ByobDB>> | null = null

export function getDB(): Promise<IDBPDatabase<ByobDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ByobDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('programs', { keyPath: 'id' })

        const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('date', 'date')
        sessions.createIndex('dayId', 'dayId')

        db.createObjectStore('weekPlans', { keyPath: 'programWeek' })
        db.createObjectStore('meals', { keyPath: 'date' })

        // Single-record stores and the key-value store use out-of-line keys.
        db.createObjectStore('profile')
        db.createObjectStore('settings')
        db.createObjectStore('meta')
      },
    })
  }
  return dbPromise
}
