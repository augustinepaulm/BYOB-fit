import { describe, expect, it } from 'vitest'

import { showDisclaimerOn } from './notices.ts'

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
