/// <reference types="node" />
// EXEC-13-rework commit I, task 15 (D-083 rules 1 and 2): Train in the v3 design.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ROW_TARGET } from '../screens/DeckScreen.tsx'
import { entryLine, prescriptionSentence } from './prescription.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const deck = read('../screens/DeckScreen.tsx')
const css = read('../ui/v3.css')

describe('Swap is for today only (D-083 rule 1)', () => {
  it('has no Today only / Rest of program control', () => {
    for (const file of ['../screens/DeckScreen.tsx', '../screens/SwapStep.tsx']) {
      expect(read(file), file).not.toContain('Rest of program')
      expect(read(file), file).not.toContain('Today only')
    }
  })
  it('asks how to log it today, with the D-069 rule 8 prescription fields', () => {
    const swap = read('../screens/SwapStep.tsx')
    expect(swap).toContain('How do you want to log it today?')
    for (const field of ["field('sets'", "field('repMin'", "field('repMax'", "field('holdSec'", "field('restSec'"]) expect(swap).toContain(field)
    expect(swap).toContain('Swap for today')
    expect(deck).toContain('api.changeExercise(current.item.id, swapPick.id, fields)')
  })
})

describe('The summary shows the suggestion as text (D-083 rule 2)', () => {
  it('builds no Use or Keep weight buttons', () => {
    expect(deck).not.toMatch(/>\s*Use \{?[^<]*kg/)
    expect(deck).not.toMatch(/Keep \{[^}]*\} ?kg/)
    expect(deck).not.toMatch(/Use \$\{/)
    const ready = deck.slice(deck.indexOf('<h2 className="compare__title">Ready to progress</h2>'), deck.indexOf('</section>', deck.indexOf('Ready to progress</h2>')))
    expect(ready).not.toContain('<button')
    expect(ready).toContain('{r.text}')
  })
})

describe('Motion (README) with reduce-motion versions', () => {
  it('the set tick eases to tint over 180 ms, sheets rise over 240 ms', () => {
    expect(css).toMatch(/\.set-done \{[^}]*animation: set-done 180ms/)
    expect(css).toMatch(/animation: sheet-rise 240ms/)
  })
  it('reduce motion: no tick easing, sheets cross-fade over 120 ms, the ring steps', () => {
    const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduce).toContain('animation: sheet-fade 120ms linear')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.set-done \{\s*animation: none;/)
    expect(reduce).toMatch(/\.ring__fill \{\s*transition: none;/)
  })
})

describe('Keyboard open (4.09)', () => {
  it('puts the active set row above the screen midline', () => {
    expect(ROW_TARGET).toBeLessThan(0.5)
    expect(deck).toContain('(viewport?.height ?? window.innerHeight) * ROW_TARGET')
  })
  it('the tab bar steps aside while a set box has focus', () => {
    expect(css).toMatch(/:root\[data-keyboard='open'\] \.tabbar/)
  })
})

describe('deck text (frames 2.04 to 2.07)', () => {
  it('prescription sentences', () => {
    expect(prescriptionSentence({ sets: 4, repMin: 6, repMax: 8 })).toBe('4 sets of 6 to 8')
    expect(prescriptionSentence({ sets: 3, repMin: 12, repMax: 15, perSide: true })).toBe('3 sets of 12 to 15, each side')
    expect(prescriptionSentence({ sets: 3, holdSec: 45 })).toBe('3 holds of 45 s')
    expect(prescriptionSentence({ minutes: 5 })).toBe('5 minutes')
    expect(prescriptionSentence({ sets: 1, repMin: 10 })).toBe('1 set of 10')
  })
  it('last week in one line', () => {
    expect(entryLine([{ weight: 70, reps: 8 }, { weight: 70, reps: 8 }, { weight: 70, reps: 7 }, { weight: 70, reps: 7 }], 'kg')).toBe('70 kg × 8, 8, 7, 7')
    expect(entryLine([{ weight: 70, reps: 8 }, { weight: 72.5, reps: 6 }], 'kg')).toBe('70 × 8, 72.5 × 6')
    expect(entryLine([{ seconds: 45 }, { seconds: 40 }], 'kg')).toBe('45 s, 40 s')
    expect(entryLine([], 'kg')).toBe('')
  })
  it('the rest panel offers +15 s and Skip', () => {
    expect(deck).toContain('setRestUntil((until) => (until ?? Date.now()) + 15000)')
    expect(deck).toContain('onClick={() => setRestUntil(null)}')
  })
  it('the timed hold logs with or without the timer (2.06)', () => {
    expect(deck).toContain("{holdStarted ? 'Stop and log' : 'Start the timer'}")
    expect(deck).toContain('Log {holdTarget} s without the timer')
  })
  it('cardio has a minutes stepper and a timer (2.07)', () => {
    expect(deck).toContain('aria-label="One minute less"')
    expect(deck).toContain('aria-label="One minute more"')
    expect(deck).toContain("{...numberBoxAttributes('box-cardio-min')}")
  })
})
