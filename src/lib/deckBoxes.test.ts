/// <reference types="node" />
// EXEC-11.3 task 8 (D-054 rules 1 and 5). The deck needs IndexedDB and a
// router to render, so its choices are tested through the pure helpers it
// calls, and the source is checked to call them for every box and cell.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { Entry } from '../types/stores.ts'
import { exactReferenceSet } from './session.ts'
import { numberBoxAttributes } from './setBoxes.ts'

const deck = readFileSync(new URL('../screens/DeckScreen.tsx', import.meta.url), 'utf8')

const lastWeek = (sets: Entry['sets']): Entry => ({ itemId: 'i1', exerciseId: 'face-pull', sets })

describe('last-week cell (D-054 rule 5)', () => {
  it('a row with last week’s value for the same row gets the cell’s value', () => {
    expect(exactReferenceSet(lastWeek([{ n: 1, weight: 20, reps: 15 }]), { n: 1 })).toEqual({ n: 1, weight: 20, reps: 15 })
  })

  it('a first-session row has none', () => {
    expect(exactReferenceSet(undefined, { n: 1 })).toBeUndefined()
    expect(exactReferenceSet(lastWeek([{ n: 1, weight: 20, reps: 15 }]), { n: 2 })).toBeUndefined()
  })

  it('a per-side row whose other side has last week’s value, but not this side, has none', () => {
    const entry = lastWeek([{ n: 1, side: 'L', weight: 12, reps: 8 }])
    expect(exactReferenceSet(entry, { n: 1, side: 'L' })).toEqual({ n: 1, side: 'L', weight: 12, reps: 8 })
    expect(exactReferenceSet(entry, { n: 1, side: 'R' })).toBeUndefined()
  })

  it('a raw row with no value is not a reference', () => {
    expect(exactReferenceSet(lastWeek([{ n: 1, raw: '5, 135' }]), { n: 1 })).toBeUndefined()
  })

  it('the deck renders the cell only from exactReference, nowhere else', () => {
    expect(deck.match(/className="dk-set__ref"/g)).toHaveLength(1)
    expect(deck).toMatch(/const reference = exactReference\(row\)\s*\n\s*return reference \? <span className="dk-set__ref">/)
  })
})

describe('number box attributes (D-054 rule 1)', () => {
  it('carries the five attributes, a neutral name equal to the id', () => {
    expect(numberBoxAttributes('box-cardio-min')).toEqual({
      id: 'box-cardio-min',
      name: 'box-cardio-min',
      type: 'text',
      autoComplete: 'off',
      autoCorrect: 'off',
      autoCapitalize: 'off',
      spellCheck: false,
    })
  })

  it('every input in the deck (the set boxes and the cardio box) spreads them first', () => {
    const inputs = deck.split('<input').slice(1)
    expect(inputs).toHaveLength(2)
    for (const input of inputs) expect(input.trimStart().startsWith('{...numberBoxAttributes(')).toBe(true)
    expect(deck).toContain("{...numberBoxAttributes('box-cardio-min')}")
    expect(deck).toContain('{...numberBoxAttributes(id)}')
    // Nothing overrides them afterwards, and no purpose-naming autocomplete value.
    expect(deck).not.toMatch(/autoComplete="(?!off)/)
    expect(deck).not.toMatch(/one-time-code/)
  })

  it('the session note keeps its own attributes', () => {
    const note = deck.slice(deck.indexOf('<textarea'), deck.indexOf('/>', deck.indexOf('<textarea')))
    expect(note).toContain('aria-label="Session note"')
    expect(note).not.toContain('numberBoxAttributes')
  })
})
