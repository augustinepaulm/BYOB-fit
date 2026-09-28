import { describe, expect, it } from 'vitest'

import type { Goals, SentLogEntry } from '../types/stores.ts'
import {
  backupFilename,
  backupFromData,
  parseBackup,
  validateBackup,
} from './backup.ts'

/** A version 1 envelope, as the Phase 5 build wrote it. */
function envelopeV1(): Record<string, unknown> {
  return {
    app: 'BYOB-fit',
    schemaVersion: 1,
    exportedAt: '2026-09-27T10:00:00.000Z',
    programs: [],
    sessions: [],
    weekPlans: [],
    meals: [],
    profile: null,
    settings: { model: 'claude-sonnet-5' },
    reprograms: [],
    meta: { activeProgramId: 'sample' },
  }
}

const goals: Goals = {
  items: [
    { rank: 1, type: 'get_stronger', target: { amount: 10, unit: 'percent', exerciseId: 'squat' } },
    { rank: 2, type: 'improve_cardio' },
  ],
  timeframeWeeks: 12,
  startDate: '2026-09-27',
  currentStats: { weight: 82, weightUnit: 'kg' },
  updatedAt: '2026-09-27T10:00:00.000Z',
}

const sentLog: SentLogEntry[] = [
  {
    id: 's1',
    at: '2026-09-27T11:00:00.000Z',
    kind: 'update',
    privacyLevel: 'minimal',
    payloadSummary: 'Program, last week of sets, goal',
    payload: { messages: [{ role: 'user', content: 'x' }] },
  },
]

function storeData() {
  return {
    programs: [],
    sessions: [],
    weekPlans: [],
    meals: [],
    profile: null,
    settings: { apiKey: 'sk-ant-secret', model: 'claude-sonnet-5', storagePersisted: true },
    reprograms: [],
    meta: { activeProgramId: 'sample' },
    goals,
    sentLog,
  }
}

describe('backup envelope validator', () => {
  it('imports a version 1 file with no goals and an empty sent log', () => {
    const result = parseBackup(JSON.stringify(envelopeV1()))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.schemaVersion).toBe(2)
    expect(result.backup.goals).toBeNull()
    expect(result.backup.sentLog).toEqual([])
    expect(result.backup.meta.activeProgramId).toBe('sample')
  })

  it('round-trips a version 2 file, goals and sent log included', () => {
    const written = backupFromData(storeData(), new Date('2026-09-27T12:00:00Z'))
    expect(written.schemaVersion).toBe(2)
    const result = parseBackup(JSON.stringify(written))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup).toEqual(written)
    expect(result.backup.goals).toEqual(goals)
    expect(result.backup.sentLog).toEqual(sentLog)
  })

  it('never writes the API key, or this device’s storage fields', () => {
    const text = JSON.stringify(backupFromData(storeData()))
    expect(text).not.toContain('apiKey')
    expect(text).not.toContain('sk-ant-secret')
    expect(text).not.toContain('storagePersisted')
  })

  it('refuses a version 2 file without its sent log', () => {
    const file: Record<string, unknown> = { ...envelopeV1(), schemaVersion: 2, goals: null }
    const result = validateBackup(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('/sentLog: must be an array')
  })

  it('refuses a file with a required field missing', () => {
    const file = envelopeV1()
    delete file.sessions
    const result = validateBackup(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('/sessions: must be an array')
  })

  it('refuses a missing exportedAt', () => {
    const file = envelopeV1()
    delete file.exportedAt
    const result = validateBackup(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/^\/exportedAt/)
  })

  it('refuses a missing schemaVersion instead of guessing', () => {
    const file = envelopeV1()
    delete file.schemaVersion
    file.backupVersion = 1
    const result = validateBackup(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/^\/schemaVersion: missing\./)
  })

  it('refuses version 3', () => {
    const result = validateBackup({ ...envelopeV1(), schemaVersion: 3, goals: null, sentLog: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toBe(
        '/schemaVersion: this build reads versions 1 and 2, the file says 3. Nothing was imported',
      )
    }
  })

  it('refuses corrupt JSON', () => {
    const text = JSON.stringify(envelopeV1()).slice(0, 40)
    const result = parseBackup(text)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/^\/: the file is not valid JSON/)
  })

  it('refuses a file from another app', () => {
    const result = validateBackup({ ...envelopeV1(), app: 'Other' })
    expect(result.ok).toBe(false)
  })
})

describe('backupFilename', () => {
  it('uses the export prefix and the ISO date', () => {
    expect(backupFilename(new Date('2026-09-27T23:00:00Z'))).toBe(
      'byob-fit-export-2026-09-27.json',
    )
  })
})
