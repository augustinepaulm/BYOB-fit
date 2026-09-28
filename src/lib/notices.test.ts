import { describe, expect, it } from 'vitest'

import { shouldShowBackupNote, showDisclaimerOn } from './notices.ts'

describe('showDisclaimerOn (D-041)', () => {
  it('hides the banner on onboarding', () => {
    expect(showDisclaimerOn('/welcome')).toBe(false)
  })
  it('shows it everywhere else', () => {
    for (const path of ['/', '/import', '/week', '/deck', '/settings', '/goal', '/log/bench']) {
      expect(showDisclaimerOn(path)).toBe(true)
    }
  })
})

describe('shouldShowBackupNote (D-050 rule 2)', () => {
  const now = new Date('2026-09-28T09:00:00Z')
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
  it('shows with no export, the reminder on by default', () => {
    expect(shouldShowBackupNote({}, now)).toBe(true)
    expect(shouldShowBackupNote(null, now)).toBe(true)
  })
  it('hidden when the reminder is off', () => {
    expect(shouldShowBackupNote({ backupReminder: false }, now)).toBe(false)
  })
  it('hidden within 30 days of an export, shown after', () => {
    expect(shouldShowBackupNote({ lastExportAt: daysAgo(0) }, now)).toBe(false)
    expect(shouldShowBackupNote({ lastExportAt: daysAgo(30) }, now)).toBe(false)
    expect(shouldShowBackupNote({ lastExportAt: daysAgo(31) }, now)).toBe(true)
  })
  it('a dismissal hides it until 30 days after that', () => {
    expect(shouldShowBackupNote({ backupNoteDismissedAt: daysAgo(1) }, now)).toBe(false)
    expect(shouldShowBackupNote({ backupNoteDismissedAt: daysAgo(29), lastExportAt: daysAgo(90) }, now)).toBe(false)
    expect(shouldShowBackupNote({ backupNoteDismissedAt: daysAgo(31) }, now)).toBe(true)
  })
})
