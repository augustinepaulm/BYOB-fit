import { describe, expect, it } from 'vitest'

import { privacyLevelOf, unitsOf } from './defaults.ts'

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
})
