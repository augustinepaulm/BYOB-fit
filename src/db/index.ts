// Repository layer. Every read and write to IndexedDB goes through a named
// function here, so screens never hold a raw database handle.

import { endedAsItStands } from '../lib/dayChanges.ts'
import type { Program } from '../types/program.ts'
import type {
  BodyEntry,
  Goals,
  MealDay,
  Profile,
  Reprogram,
  SentLogEntry,
  Session,
  Settings,
  DayChange,
  WeekNote,
} from '../types/stores.ts'
import { isEmptySession, sessionIdFor } from '../lib/session.ts'
import {
  ACTIVE_PROGRAM_KEY,
  GOALS_KEY,
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

// ── Key-value meta ──

export async function getMeta(key: string): Promise<string | undefined> {
  const db = await getDB()
  return db.get('meta', key)
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDB()
  await db.put('meta', value, key)
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await getDB()
  await db.delete('meta', key)
}

// ── Day changes (D-069) ──

/** Every changed date, in date order. */
export async function getDayChanges(): Promise<DayChange[]> {
  const db = await getDB()
  return db.getAll('dayChanges')
}

export async function putDayChange(change: DayChange): Promise<void> {
  const db = await getDB()
  await db.put('dayChanges', change)
}

export async function deleteDayChange(date: string): Promise<void> {
  const db = await getDB()
  await db.delete('dayChanges', date)
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

/** D-086: an ended session with nothing in it is removed, not kept. */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('sessions', id)
}

/**
 * D-069 rule 4: before a date's day changes, its open session ends as it
 * stands, as End does. What was logged stays; a session with nothing logged
 * is deleted instead (D-086). True when one was ended or deleted.
 */
export async function endOpenSession(date: string, dayId: string): Promise<boolean> {
  const db = await getDB()
  const session = await db.get('sessions', sessionIdFor(date, dayId))
  if (!session || session.endedAt) return false
  if (isEmptySession(session)) await db.delete('sessions', session.id)
  else await db.put('sessions', endedAsItStands(session, new Date()))
  return true
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

// ── Goals and sent log (PLAN v1.5 section 5; no screen uses them yet) ──

export async function getGoals(): Promise<Goals | undefined> {
  const db = await getDB()
  return db.get('goals', GOALS_KEY)
}

export async function saveGoals(goals: Goals): Promise<void> {
  const db = await getDB()
  await db.put('goals', goals, GOALS_KEY)
}

/** Append only: an entry with an id already in the log is refused. */
export async function appendSentLog(entry: SentLogEntry): Promise<void> {
  const db = await getDB()
  await db.add('sentLog', entry)
}

/** Records how a logged call ended; nothing else in the entry changes (D-050 rule 1). */
export async function setSentLogStatus(id: string, status: 'sent' | 'failed', error?: string): Promise<void> {
  const db = await getDB()
  const entry = await db.get('sentLog', id)
  if (!entry) return
  const next: SentLogEntry = { ...entry, status }
  if (error !== undefined) next.error = error
  await db.put('sentLog', next)
}

/** Every sent-log entry, oldest first. */
export async function listSentLog(): Promise<SentLogEntry[]> {
  const db = await getDB()
  return db.getAllFromIndex('sentLog', 'at')
}

// ── Body entries (D-078) ──

/** Every body entry, oldest first. */
export async function listBodyEntries(): Promise<BodyEntry[]> {
  const db = await getDB()
  return db.getAll('bodyEntries')
}

export async function getBodyEntry(date: string): Promise<BodyEntry | undefined> {
  const db = await getDB()
  return db.get('bodyEntries', date)
}

/** One entry per date: a new entry for the same date replaces it (D-078 rule 1). */
export async function putBodyEntry(entry: BodyEntry): Promise<void> {
  const db = await getDB()
  await db.put('bodyEntries', entry)
}

export async function deleteBodyEntry(date: string): Promise<void> {
  const db = await getDB()
  await db.delete('bodyEntries', date)
}

// ── Week notes (D-081) ──

export async function addWeekNote(note: WeekNote): Promise<void> {
  const db = await getDB()
  await db.add('weekNotes', note)
}

/** Notes for one week, newest first. */
export async function listWeekNotes(weekStart: string): Promise<WeekNote[]> {
  const db = await getDB()
  const notes = await db.getAllFromIndex('weekNotes', 'weekStart', weekStart)
  return notes.sort((a, b) => b.at.localeCompare(a.at))
}

/** Everything the export contains, and everything Reset and Import replace. */
export const DATA_STORES = [
  'programs',
  'sessions',
  'dayChanges',
  'meals',
  'profile',
  'settings',
  'reprograms',
  'meta',
  'goals',
  'sentLog',
  'bodyEntries',
  'weekNotes',
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
  dayChanges: DayChange[]
  meals: MealDay[]
  profile: Profile | null
  settings: Settings | null
  reprograms: Reprogram[]
  meta: Record<string, string>
  goals: Goals | null
  sentLog: SentLogEntry[]
  bodyEntries: BodyEntry[]
  weekNotes: WeekNote[]
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
    dayChanges: await db.getAll('dayChanges'),
    meals: await db.getAll('meals'),
    profile: (await db.get('profile', PROFILE_KEY)) ?? null,
    settings: (await db.get('settings', SETTINGS_KEY)) ?? null,
    reprograms: await db.getAll('reprograms'),
    meta,
    goals: (await db.get('goals', GOALS_KEY)) ?? null,
    sentLog: await db.getAllFromIndex('sentLog', 'at'),
    bodyEntries: await db.getAll('bodyEntries'),
    weekNotes: await db.getAll('weekNotes'),
  }
}

/** Replace every store with the contents of an export. */
export async function replaceAllStores(data: {
  programs: Program[]
  sessions: Session[]
  dayChanges: DayChange[]
  meals: MealDay[]
  profile: Profile | null
  settings: Settings | null
  reprograms: Reprogram[]
  meta: Record<string, string>
  goals: Goals | null
  sentLog: SentLogEntry[]
  bodyEntries: BodyEntry[]
  weekNotes: WeekNote[]
}): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(DATA_STORES, 'readwrite')
  await Promise.all(DATA_STORES.map((name) => tx.objectStore(name).clear()))
  for (const program of data.programs) await tx.objectStore('programs').put(program)
  for (const s of data.sessions) await tx.objectStore('sessions').put(s)
  for (const change of data.dayChanges) await tx.objectStore('dayChanges').put(change)
  for (const meal of data.meals) await tx.objectStore('meals').put(meal)
  for (const record of data.reprograms) await tx.objectStore('reprograms').put(record)
  if (data.profile) await tx.objectStore('profile').put(data.profile, PROFILE_KEY)
  if (data.settings) await tx.objectStore('settings').put(data.settings, SETTINGS_KEY)
  for (const [key, value] of Object.entries(data.meta)) {
    await tx.objectStore('meta').put(value, key)
  }
  if (data.goals) await tx.objectStore('goals').put(data.goals, GOALS_KEY)
  for (const entry of data.sentLog) await tx.objectStore('sentLog').put(entry)
  for (const entry of data.bodyEntries) await tx.objectStore('bodyEntries').put(entry)
  for (const note of data.weekNotes) await tx.objectStore('weekNotes').put(note)
  await tx.done
}
