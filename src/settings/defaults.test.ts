import { describe, expect, it } from 'vitest'

import { appearanceOf, effectiveTheme, privacyLevelOf, unitsOf } from './defaults.ts'

describe('settings defaults (PLAN v1.5 section 5)', () => {
  it('reads a missing units as kg', () => {
    expect(unitsOf(undefined)).toBe('kg')
    expect(unitsOf({ model: 'm' })).toBe('kg')
    expect(unitsOf({ units: 'lb' })).toBe('lb')
  })

  it('reads a missing privacyLevel as minimal', () => {
    expect(privacyLevelOf(null)).toBe('minimal')
    expect(privacyLevelOf({})).toBe('minimal')
    expect(privacyLevelOf({ privacyLevel: 'full' })).toBe('full')
  })

  it('reads a missing appearance as system', () => {
    expect(appearanceOf(undefined)).toBe('system')
    expect(appearanceOf({})).toBe('system')
    expect(appearanceOf({ appearance: 'dark' })).toBe('dark')
  })
})

describe('effectiveTheme (D-039)', () => {
  it.each([
    ['system', false, 'light'],
    ['system', true, 'dark'],
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
  ] as const)('%s with the phone in dark = %s gives %s', (appearance, prefersDark, expected) => {
    expect(effectiveTheme(appearance, prefersDark)).toBe(expected)
  })
})
