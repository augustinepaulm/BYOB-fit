/// <reference types="node" />
// EXEC-11.9 commit B (D-075 rules 3 and 4): every way into the summary ends
// the session at once, never creating one or moving its end time; the deck's
// swap picker starts with Same muscles off. The hook needs IndexedDB, so its
// decision is tested as `sessionToEnd` plus source checks; the browser run
// (task 9) covers the rest.
import { readFileSync } from 'node:fs'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import upperLower from '../../public/templates/starter-4day-upper-lower.json'
import { ExercisePicker } from '../builder/ExercisePicker.tsx'
import type { Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { sessionToEnd } from './session.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const open: Session = { id: '2026-09-29__tue', date: '2026-09-29', dayId: 'tue', programWeek: 8, startedAt: '2026-09-29T09:00:00.000Z', entries: [] }
const END = new Date('2026-09-29T09:40:00.000Z')
const DONE = new Date('2026-09-29T09:45:00.000Z')

describe('end() (D-075 rule 3)', () => {
  it('with no stored session writes nothing', () => {
    expect(sessionToEnd(null, END)).toBeNull()
    expect(sessionToEnd(undefined, END)).toBeNull()
  })
  it('with an open session sets endedAt now', () => {
    expect(sessionToEnd(open, END)).toEqual({ ...open, endedAt: END.toISOString() })
  })
  it('with an ended session leaves it', () => {
    expect(sessionToEnd({ ...open, endedAt: END.toISOString() }, DONE)).toBeNull()
  })
  it('reads the stored session from the ref and never calls ensure()', () => {
    const hook = read('../session/useSession.ts')
    const end = hook.slice(hook.indexOf('const end = useCallback'), hook.indexOf('return {', hook.indexOf('const end = useCallback')))
    expect(end).toContain('sessionToEnd(sessionRef.current, new Date())')
    expect(end).not.toContain('ensure')
  })
  it('finish() after end() keeps the first endedAt', () => {
    const hook = read('../session/useSession.ts')
    expect(hook).toContain('await commit(current.endedAt ? current : { ...current, endedAt: new Date().toISOString() })')
    const ended = sessionToEnd(open, END)!
    const finished = ended.endedAt ? ended : { ...ended, endedAt: DONE.toISOString() }
    expect(finished.endedAt).toBe(END.toISOString())
  })
})

describe('every way into the summary calls end() (D-075 rule 3)', () => {
  const deck = read('../screens/DeckScreen.tsx')
  const before = (anchor: string) => {
    const at = deck.indexOf(anchor)
    expect(at, anchor).toBeGreaterThan(-1)
    const summary = deck.indexOf("setPhase('summary')", at)
    return deck.slice(at, summary)
  }
  it('the last exercise finished (advance)', () => {
    expect(before('if (from >= deck.length - 1) {')).toContain('void api.end()')
  })
  it('End with nothing left (endFlow)', () => {
    expect(before("if (endStep(notDone) === 'confirm') {")).toContain('void api.end()')
  })
  it('the End dialog’s End session', () => {
    expect(before('confirmLabel="End session"')).toContain('void api.end()')
  })
  it('End session on the resume prompt', () => {
    expect(before("label: 'End session',")).toContain('void api.end()')
  })
  it('there are exactly four ways into the summary', () => {
    expect(deck.match(/setPhase\('summary'\)/g)).toHaveLength(4)
    expect(deck.match(/void api\.end\(\)/g)).toHaveLength(4)
  })
})

describe('Same muscles in the swap picker (D-075 rule 4, D-072 rule 2)', () => {
  const program = upperLower as unknown as Program
  const squat = { id: 'back-squat', exercise: program.exercises['back-squat'] }
  const library = Object.entries(program.exercises).map(([id, exercise]) => ({ id, exercise }))
  const sameOn = (props: Record<string, unknown>) => {
    const html = renderToStaticMarkup(
      createElement(ExercisePicker, { title: 'Swap', current: squat, library, beginnerDefault: false, draft: program, onPick: () => {}, onBack: () => {}, ...props }),
    )
    const chip = html.match(/<button[^>]*aria-pressed="(true|false)"[^>]*>Same muscles<\/button>/)
    expect(chip, 'Same muscles chip').not.toBeNull()
    return chip![1] === 'true'
  }
  it('the exercise has muscles', () => {
    expect(squat.exercise.muscles?.length).toBeGreaterThan(0)
  })
  it('the deck’s mid-workout swap starts it off', () => {
    expect(sameOn({ allowCreate: false, sameMusclesOff: true })).toBe(false)
    expect(read('../screens/DeckScreen.tsx')).toMatch(/allowCreate=\{false\}\s*sameMusclesOff/)
  })
  it('a builder picker still starts it on', () => {
    expect(sameOn({})).toBe(true)
    for (const f of ['../builder/FormsBuilder.tsx', '../builder/StarterReview.tsx']) expect(read(f), f).not.toContain('sameMusclesOff')
  })
})
