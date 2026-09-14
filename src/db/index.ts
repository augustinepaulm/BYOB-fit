// Repository layer. Every read and write to IndexedDB goes through a named
// function here, so screens never hold a raw database handle.

import type { Program } from '../types/program.ts'
import type {
  MealDay,
  Profile,
  Reprogram,
  Session,
  Settings,
  WeekPlan,
} from '../types/stores.ts'
import { sessionIdFor } from '../lib/session.ts'
import {
  ACTIVE_PROGRAM_KEY,
  PROFILE_KEY,
  SETTINGS_KEY,
  getDB,
} from './database.ts'

export { DB_NAME, DB_VERSION, getDB } from './database.ts'
export type { ByobDB } from './database.ts'

// ── Programs ──

export async function saveProgram(program: Program): Promise<void> {
  const db = await getDB()
  await db.put('programs', program)
}

export async function getProgram(id: string): Promise<Program | undefined> {
  const db = await getDB()
  return db.get('programs', id)
}

export async function listPrograms(): Promise<Program[]> {
  const db = await getDB()
  return db.getAll('programs')
}

export async function setActiveProgram(id: string): Promise<void> {
  const db = await getDB()
  await db.put('meta', id, ACTIVE_PROGRAM_KEY)
}

export async function getActiveProgramId(): Promise<string | undefined> {
  const db = await getDB()
  return db.get('meta', ACTIVE_PROGRAM_KEY)
}

export async function getActiveProgram(): Promise<Program | undefined> {
  const id = await getActiveProgramId()
  if (!id) return undefined
  return getProgram(id)
}

// ── Week plans ──

export async function getWeekPlan(
  programWeek: number,
): Promise<WeekPlan | undefined> {
  const db = await getDB()
  return db.get('weekPlans', programWeek)
}

export async function saveWeekPlan(weekPlan: WeekPlan): Promise<void> {
  const db = await getDB()
  await db.put('weekPlans', weekPlan)
}

// ── Sessions ──

export async function saveSession(session: Session): Promise<void> {
  const db = await getDB()
  await db.put('sessions', session)
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB()
  return db.get('sessions', id)
}

export async function listSessionsByDay(dayId: string): Promise<Session[]> {
  const db = await getDB()
  return db.getAllFromIndex('sessions', 'dayId', dayId)
}

export async function listSessionsByDate(date: string): Promise<Session[]> {
  const db = await getDB()
  return db.getAllFromIndex('sessions', 'date', date)
}

export async function listAllSessions(): Promise<Session[]> {
  const db = await getDB()
  return db.getAll('sessions')
}

/** One session per (date, dayId); the id encodes the pair. */
export async function getSessionByDateAndDay(
  date: string,
  dayId: string,
): Promise<Session | undefined> {
  const db = await getDB()
  return db.get('sessions', sessionIdFor(date, dayId))
}

export async function listSessionsBetween(
  fromDate: string,
  toDate: string,
): Promise<Session[]> {
  const db = await getDB()
  return db.getAllFromIndex(
    'sessions',
    'date',
    IDBKeyRange.bound(fromDate, toDate),
  )
}

// ── Profile, meals, settings ──

export async function getProfile(): Promise<Profile | undefined> {
  const db = await getDB()
  return db.get('profile', PROFILE_KEY)
}

export async function saveProfile(profile: Profile): Promise<void> {
  const db = await getDB()
  await db.put('profile', profile, PROFILE_KEY)
}

export async function getMealDay(date: string): Promise<MealDay | undefined> {
  const db = await getDB()
  return db.get('meals', date)
}

export async function saveMealDay(meal: MealDay): Promise<void> {
  const db = await getDB()
  await db.put('meals', meal)
}

export async function getSettings(): Promise<Settings | undefined> {
  const db = await getDB()
  return db.get('settings', SETTINGS_KEY)
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDB()
  await db.put('settings', settings, SETTINGS_KEY)
}

// ── Reprogramming records ──

export async function saveReprogram(record: Reprogram): Promise<void> {
  const db = await getDB()
  await db.put('reprograms', record)
}

export async function listReprograms(): Promise<Reprogram[]> {
  const db = await getDB()
  return db.getAll('reprograms')
}

/** Everything the export contains, and everything Reset and Import replace. */
export const DATA_STORES = [
  'programs',
  'sessions',
  'weekPlans',
  'meals',
  'profile',
  'settings',
  'reprograms',
  'meta',
] as const

export async function clearAllStores(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(DATA_STORES, 'readwrite')
  await Promise.all(DATA_STORES.map((name) => tx.objectStore(name).clear()))
  await tx.done
}

/** Bulk read for export. The caller decides what to do with the API key. */
export async function readAllStores(): Promise<{
  programs: Program[]
  sessions: Session[]
  weekPlans: WeekPlan[]
  meals: MealDay[]
  profile: Profile | null
  settings: Settings | null
  reprograms: Reprogram[]
  meta: Record<string, string>
}> {
  const db = await getDB()
  const metaKeys = await db.getAllKeys('meta')
  const metaValues = await db.getAll('meta')
  const meta: Record<string, string> = {}
  metaKeys.forEach((key, i) => {
    meta[String(key)] = metaValues[i]
  })
  return {
    programs: await db.getAll('programs'),
    sessions: await db.getAll('sessions'),
    weekPlans: await db.getAll('weekPlans'),
    meals: await db.getAll('meals'),
    profile: (await db.get('profile', PROFILE_KEY)) ?? null,
    settings: (await db.get('settings', SETTINGS_KEY)) ?? null,
    reprograms: await db.getAll('reprograms'),
    meta,
  }
}

/** Replace every store with the contents of an export. */
export async function replaceAllStores(data: {
  programs: Program[]
  sessions: Session[]
  weekPlans: WeekPlan[]
  meals: MealDay[]
  profile: Profile | null
  settings: Settings | null
  reprograms: Reprogram[]
  meta: Record<string, string>
}): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(DATA_STORES, 'readwrite')
  await Promise.all(DATA_STORES.map((name) => tx.objectStore(name).clear()))
  for (const program of data.programs) await tx.objectStore('programs').put(program)
  for (const s of data.sessions) await tx.objectStore('sessions').put(s)
  for (const plan of data.weekPlans) await tx.objectStore('weekPlans').put(plan)
  for (const meal of data.meals) await tx.objectStore('meals').put(meal)
  for (const record of data.reprograms) await tx.objectStore('reprograms').put(record)
  if (data.profile) await tx.objectStore('profile').put(data.profile, PROFILE_KEY)
  if (data.settings) await tx.objectStore('settings').put(data.settings, SETTINGS_KEY)
  for (const [key, value] of Object.entries(data.meta)) {
    await tx.objectStore('meta').put(value, key)
  }
  await tx.done
}
