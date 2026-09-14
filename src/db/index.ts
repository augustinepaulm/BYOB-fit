// Repository layer. Every read and write to IndexedDB goes through a named
// function here, so screens never hold a raw database handle.

import type { Program } from '../types/program.ts'
import type {
  MealDay,
  Profile,
  Session,
  Settings,
  WeekPlan,
} from '../types/stores.ts'
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
