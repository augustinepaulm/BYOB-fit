/// <reference types="node" />
// EXEC-13-rework commit J, task 16: onboarding, Profile, Settings and states in v3.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PRIVACY_LEVELS } from './payload.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('1a: Restore from a backup (D-072 rule 1, D-083 rule 3)', () => {
  const onboarding = read('../screens/OnboardingScreen.tsx')
  const welcome = onboarding.slice(onboarding.indexOf("// ── 1a Welcome ──"), onboarding.indexOf("// ── 1b Two questions ──"))
  it('offers it as a tertiary under Get started', () => {
    expect(welcome.indexOf('Get started')).toBeLessThan(welcome.indexOf('Restore from a backup'))
    expect(welcome).toContain('className="btn btn--tertiary ob-restore"')
  })
  it('runs the same import as Settings', () => {
    expect(onboarding).toContain('const result = await restoreFromText(text)')
    expect(read('../screens/SettingsScreen.tsx')).toContain('const result = await restoreFromText(text)')
    const restore = read('../settings/restore.ts')
    expect(restore).toContain('await restoreBackup(result.backup)')
    expect(restore).toContain('applyAppearance(appearanceOf(result.backup.settings))')
  })
  it('a bad file shows 4.07 and changes nothing', () => {
    expect(welcome).toContain('This file couldn&apos;t be read')
    expect(welcome).toContain("It isn&apos;t a BYOB-fit file, or it&apos;s damaged. Nothing on your phone was changed.")
    expect(onboarding.indexOf('const checked = checkBackup(text)')).toBeLessThan(onboarding.indexOf('const result = await restoreFromText(text)'))
  })
})

describe('1k: privacy levels keep D-044 names (D-084 rule 1)', () => {
  it('Full reads "Adds current weight"', () => {
    expect(PRIVACY_LEVELS.map((l) => `${l.title}: ${l.sub}`)).toEqual([
      'Minimal: Your workouts, program and goal',
      'Standard: Adds experience level and "felt off" flags',
      'Full: Adds current weight',
    ])
  })
})

describe('Profile (3.15)', () => {
  const profile = read('../screens/ProfileScreen.tsx')
  it('groups Goals, Program and Settings, with the targets under the goal', () => {
    for (const group of ['title="Goals"', 'title="Program"', 'title="Settings"']) expect(profile).toContain(group)
    expect(profile).toContain('Calorie target')
    expect(profile).toContain('title="Height, age and sex"')
    for (const row of ['title="Units"', 'title="Appearance"', 'title="AI"', 'title="Privacy level"', 'title="AI usage and budget"', 'title="Export data"', 'title="Import data"', 'title="Sent log"', 'title="Privacy"']) {
      expect(profile, row).toContain(row)
    }
    expect(profile).toContain('Everything stays on this phone. BYOB-fit is free and open source.')
  })
  it('keeps current stats and the free fields', () => {
    expect(profile).toContain('title="Current stats"')
    expect(profile).toContain('title="Other details"')
  })
})

describe('states (4.01, 4.05, 4.07, 4.08)', () => {
  it('4.01 no program', () => {
    const today = read('../screens/TodayScreen.tsx')
    expect(today).toContain('Pick a starter, or build your own with forms. You can change everything later.')
    expect(today).toContain("label: 'Choose a program'")
    expect(today).toContain('Import a program file')
  })
  it('4.05 reading an import', () => {
    expect(read('../screens/ImportScreen.tsx')).toContain('`Reading ${fileName}`')
  })
  it('4.07 unreadable import', () => {
    const state = read('../ui/StateBlock.tsx')
    expect(state).toContain('This file couldn’t be read')
    expect(state).toContain('Choose another file')
  })
  it('4.08 offline: everything works except AI', () => {
    expect(read('../pwa/AppNotices.tsx')).toContain("You're offline. Everything works except AI.")
    expect(read('../ai/useWeekReview.tsx')).toContain('Review this week when back online')
  })
})

describe('restyled without layout changes (D-083 rule 3)', () => {
  const css = read('../ui/v3.css')
  it('the shared classes take v3 tokens, type and radii', () => {
    for (const selector of ['.ob-primary', '.ob-row', '.bd-input', '.st-block', '.bd-chip', '.ob-seg__opt--on']) expect(css, selector).toContain(selector)
  })
})

describe('docks clear the in-progress bar (found in task 17e)', () => {
  it('with a workout open elsewhere, bottom docks sit above the bar, and drop to the bottom with the keyboard', () => {
    const css = read('../ui/v3.css')
    expect(css).toMatch(/\.app--tabbed:has\(\.inprogress\) \.dock-v3,[\s\S]{0,120}bottom: calc\(var\(--tabbar-h\) \+ var\(--inprogress-h\) \+ 16px\);/)
    expect(css).toMatch(/:root\[data-keyboard='open'\] \.app--tabbed:has\(\.inprogress\) \.dock-v3,[\s\S]{0,80}bottom: 0;/)
  })
})
