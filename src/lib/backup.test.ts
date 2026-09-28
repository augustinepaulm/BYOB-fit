import { describe, expect, it } from 'vitest'

import { backupFilename, parseBackup, validateBackup } from './backup.ts'

function envelope(): Record<string, unknown> {
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

describe('backup envelope validator', () => {
  it('accepts a valid export', () => {
    const result = parseBackup(JSON.stringify(envelope()))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.backup.schemaVersion).toBe(1)
      expect(result.backup.meta.activeProgramId).toBe('sample')
    }
  })

  it('refuses a file with a required field missing', () => {
    const file = envelope()
    delete file.sessions
    const result = validateBackup(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain('/sessions: must be an array')
  })

  it('refuses a missing exportedAt', () => {
    const file = envelope()
    delete file.exportedAt
    const result = validateBackup(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/^\/exportedAt/)
  })

  it('refuses a missing schemaVersion instead of guessing', () => {
    const file = envelope()
    delete file.schemaVersion
    file.backupVersion = 1
    const result = validateBackup(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/^\/schemaVersion: missing/)
  })

  it('refuses an unknown schemaVersion', () => {
    const result = validateBackup({ ...envelope(), schemaVersion: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/^\/schemaVersion: this build reads version 1/)
    }
  })

  it('refuses corrupt JSON', () => {
    const text = JSON.stringify(envelope()).slice(0, 40)
    const result = parseBackup(text)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/^\/: the file is not valid JSON/)
  })

  it('refuses a file from another app', () => {
    const result = validateBackup({ ...envelope(), app: 'Other' })
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
