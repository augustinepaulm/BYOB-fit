// EXEC-11.4 task 8 (D-059 rules 4 and 5): the draft rule, the stepper's
// disabled states and the length hint.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { blankProgram, lengthHint } from '../lib/builder.ts'
import { Stepper } from '../onboarding/ui.tsx'
import { draftWanted } from './draft.ts'

describe('builder draft (D-059 rule 4)', () => {
  const program = blankProgram('my-program', '2026-09-27')
  const opened = JSON.stringify(program)

  it('no draft is written before a change', () => {
    expect(draftWanted(opened, program, false)).toBe(false)
    // An identical copy is not a change.
    expect(draftWanted(opened, structuredClone(program), false)).toBe(false)
  })

  it('a draft is written after the first change', () => {
    expect(draftWanted(opened, { ...program, name: 'Push pull legs' }, false)).toBe(true)
  })

  it('after the first write it keeps writing, even when the program is back to what was opened', () => {
    expect(draftWanted(opened, program, true)).toBe(true)
  })

  it('a resumed draft keeps writing on every change and step', () => {
    // `already` is true from the start for a builder resumed from a stored draft.
    expect(draftWanted(opened, program, true)).toBe(true)
    expect(draftWanted(opened, { ...program, programWeeks: 9 }, true)).toBe(true)
  })
})

describe('Stepper (D-059 rule 5)', () => {
  const html = (value: number, min?: number, max?: number) =>
    renderToStaticMarkup(createElement(Stepper, { value, min, max, label: 'Length in weeks', onChange: () => undefined }))
  const minus = (markup: string) => /aria-label="Less Length in weeks"[^>]*disabled=""/.test(markup)
  const plus = (markup: string) => /aria-label="More Length in weeks"[^>]*disabled=""/.test(markup)

  it('minus is disabled at min, enabled above it', () => {
    expect(minus(html(8, 8, 52))).toBe(true)
    expect(minus(html(9, 8, 52))).toBe(false)
    expect(minus(html(1))).toBe(true)
  })

  it('plus is disabled at max, and never without a max', () => {
    expect(plus(html(52, 8, 52))).toBe(true)
    expect(plus(html(51, 8, 52))).toBe(false)
    expect(plus(html(500))).toBe(false)
  })
})

describe('length hint (D-059 rule 5)', () => {
  it('shows only when editing past week 1 at the minimum length', () => {
    expect(lengthHint(true, 8, 8)).toBe("You're in week 8, so the minimum is 8 weeks.")
    expect(lengthHint(true, 8, 9)).toBeNull()
    expect(lengthHint(true, 8, 12)).toBeNull()
    expect(lengthHint(true, 1, 1)).toBeNull()
    expect(lengthHint(false, 8, 8)).toBeNull()
  })
})
