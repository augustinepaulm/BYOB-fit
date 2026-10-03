// EXEC-13-rework task 9 (PLAN v1.26 section 5): a version 4 database written
// by main's code (974ddbf, tests/fixtures/database-v4.ts) opened by this build
// becomes version 5 with every existing record unchanged, and the export
// round-trips body entries and notes.
import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import type { Program } from '../src/types/program.ts'
import type { BodyEntry, DayChange, Goals, MealDay, Profile, Reprogram, SentLogEntry, Session, Settings, WeekNote } from '../src/types/stores.ts'

const program = {
  ...JSON.parse(readFileSync(new URL('../public/templates/starter-4day-upper-lower.json', import.meta.url), 'utf8')),
  id: 'ul',
  startDate: '2026-08-30',
} as Program

const sessions: Session[] = [
  {
    id: '2026-09-28__mon',
    date: '2026-09-28',
    dayId: 'mon',
    programWeek: 5,
    startedAt: '2026-09-28T09:00:00.000Z',
    endedAt: '2026-09-28T10:02:00.000Z',
    entries: [
      { itemId: 'mon-main-1', exerciseId: 'bench-press', sets: [{ n: 1, weight: 60, reps: 8 }, { n: 2, weight: 60, reps: 7, editedAt: '2026-09-29T08:00:00.000Z' }], addedSets: 1 },
      { itemId: 'mon-warm-1', exerciseId: 'bike', sets: [], checked: true, note: 'easy' },
    ],
    order: [{ itemId: 'mon-main-1', sectionId: 'mon-main' }],
  },
  { id: '2026-10-01__thu', date: '2026-10-01', dayId: 'thu', programWeek: 5, startedAt: '2026-10-01T09:00:00.000Z', swapped: true, entries: [{ itemId: 'x', exerciseId: 'row', sets: [{ n: 1, raw: 'sixty' }], feltOff: 'discomfort', skipped: true }] },
]
const meals: MealDay[] = [
  { date: '2026-10-01', lines: ['2 eggs', 'oats 80g'], parsed: { kcal: 450, proteinG: 25, items: [{ line: '2 eggs', kcal: 150, proteinG: 12, source: 'phone' }, { line: 'oats 80g', kcal: 300, proteinG: 13 }] }, parsedAt: '2026-10-01T12:00:00.000Z' },
]
const dayChanges: DayChange[] = [{ date: '2026-10-02', dayId: 'mon', setAt: '2026-09-29T09:00:00.000Z' }]
const goals: Goals = {
  items: [{ rank: 1, type: 'lose_fat' }, { rank: 2, type: 'build_muscle' }],
  timeframeWeeks: 12,
  startDate: '2026-08-30',
  currentStats: { weight: 83, weightUnit: 'kg', heightCm: 180, age: 40, sex: 'male', activity: 'active' },
  updatedAt: '2026-08-30T10:00:00.000Z',
}
const sentLog: SentLogEntry[] = [
  { id: 's1', at: '2026-09-30T10:00:00.000Z', kind: 'meals', privacyLevel: 'standard', payloadSummary: 'Lines: 1', payload: { messages: [] }, status: 'sent' },
  { id: 's2', at: '2026-10-01T10:00:00.000Z', kind: 'review', privacyLevel: 'minimal', payloadSummary: 'Program', payload: { system: 'x' }, status: 'failed', error: 'offline' },
]
const settings: Settings = { apiKey: 'sk-ant-secret', model: 'claude-sonnet-5', units: 'kg', privacyLevel: 'standard', mealFoods: [{ name: 'oats', kcal: 380, proteinG: 13 }], onboarding: { completedAt: '2026-08-30T10:00:00.000Z' } }
const profile: Profile = { fields: { name: 'A' }, updatedAt: '2026-08-30T10:00:00.000Z' }
const reprograms: Reprogram[] = [{ id: 'r1', week: 5, timestamp: '2026-09-27T10:00:00.000Z', model: 'claude-sonnet-5', raw: '{}', approved: false }]
const meta: Record<string, string> = { activeProgramId: 'ul', demoSeen: '["bench-press"]' }

async function writeVersion4() {
  const main = await import('./fixtures/database-v4.ts')
  expect(main.DB_VERSION).toBe(4)
  const db = await main.getDB()
  expect(db.version).toBe(4)
  await db.put('programs', program)
  for (const s of sessions) await db.put('sessions', s)
  for (const m of meals) await db.put('meals', m)
  for (const c of dayChanges) await db.put('dayChanges', c)
  await db.put('goals', goals, 'me')
  for (const e of sentLog) await db.put('sentLog', e)
  await db.put('settings', settings, 'app')
  await db.put('profile', profile, 'me')
  for (const r of reprograms) await db.put('reprograms', r)
  for (const [k, v] of Object.entries(meta)) await db.put('meta', v, k)
  db.close()
}

describe('database version 5 (task 9)', () => {
  it('upgrades a version 4 database written by main with every record unchanged', async () => {
    await writeVersion4()
    vi.resetModules()
    const current = await import('../src/db/index.ts')
    const db = await current.getDB()
    expect(db.version).toBe(5)
    expect([...db.objectStoreNames].sort()).toEqual(
      ['bodyEntries', 'dayChanges', 'goals', 'meals', 'meta', 'profile', 'programs', 'reprograms', 'sentLog', 'sessions', 'settings', 'weekNotes'],
    )
    const all = await current.readAllStores()
    // Byte-identical: compare the serialised records, not just their shape.
    const same = (a: unknown, b: unknown) => expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    same(all.programs, [program])
    same(
      all.sessions.sort((a, b) => a.id.localeCompare(b.id)),
      sessions,
    )
    same(all.meals, meals)
    same(all.dayChanges, dayChanges)
    same(all.goals, goals)
    same(all.sentLog, sentLog)
    same(all.settings, settings)
    same(all.profile, profile)
    same(all.reprograms, reprograms)
    same(all.meta, meta)
    expect(all.bodyEntries).toEqual([])
    expect(all.weekNotes).toEqual([])
    db.close()
  })

  it('then holds body entries by date and notes by week, and exports as version 4', async () => {
    vi.resetModules()
    const current = await import('../src/db/index.ts')
    const backup = await import('../src/lib/backup.ts')
    const entry: BodyEntry = { date: '2026-10-03', units: 'kg', weight: 83, bmrKcal: 1800, updatedAt: '2026-10-03T07:00:00.000Z' }
    await current.putBodyEntry(entry)
    // One entry per date: a second for the same date replaces it.
    await current.putBodyEntry({ ...entry, weight: 82.8 })
    expect(await current.listBodyEntries()).toEqual([{ ...entry, weight: 82.8 }])
    const older: WeekNote = { id: 'n1', weekStart: '2026-09-27', view: 'training', reply: 'First.', at: '2026-10-03T09:00:00.000Z' }
    const newer: WeekNote = { ...older, id: 'n2', reply: 'Second.', at: '2026-10-03T10:00:00.000Z' }
    await current.addWeekNote(older)
    await current.addWeekNote(newer)
    expect((await current.listWeekNotes('2026-09-27')).map((n) => n.id)).toEqual(['n2', 'n1'])

    const file = await backup.buildBackup()
    expect(file.schemaVersion).toBe(4)
    expect(JSON.stringify(file)).not.toContain('sk-ant-secret')
    const parsed = backup.parseBackup(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await current.clearAllStores()
    await backup.restoreBackup(parsed.backup)
    expect(await current.listBodyEntries()).toEqual([{ ...entry, weight: 82.8 }])
    expect((await current.listWeekNotes('2026-09-27')).map((n) => n.reply)).toEqual(['Second.', 'First.'])
    expect((await current.listAllSessions()).length).toBe(2)
  })
})
