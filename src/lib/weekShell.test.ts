/// <reference types="node" />
// EXEC-11.8 commit B (D-074 rules 6 to 8): no change on a finished date, the
// draft message on the summary, and the page not pulled past its ends.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { canChangeDate } from './dayChanges.ts'
import { discardDraftConfirmation, keepOfferLines } from './todayPlan.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const TODAY = '2026-09-29'

describe('no change on a finished date (D-074 rule 6)', () => {
  const finished = [{ date: TODAY, endedAt: '2026-09-29T10:00:00.000Z' }]
  const open = [{ date: TODAY }]
  it('finished today: neither Change nor Do this today', () => {
    expect(canChangeDate(TODAY, TODAY, finished)).toBe(false)
  })
  it('unfinished today: still offered', () => {
    expect(canChangeDate(TODAY, TODAY, open)).toBe(true)
    expect(canChangeDate(TODAY, TODAY)).toBe(true)
  })
  it('tomorrow: offered, even with today finished', () => {
    expect(canChangeDate('2026-09-30', TODAY, finished)).toBe(true)
  })
  it('past: never', () => {
    expect(canChangeDate('2026-09-28', TODAY, [])).toBe(false)
  })
  it('Week rows, Do this today and the deck’s Change today’s workout use it with sessions', () => {
    const week = read('../screens/WeekScreen.tsx')
    expect(week).toContain('canChangeDate(toISODate(date), todayIso, sessions)')
    expect(week).toContain('onDoToday={canChangeDate(todayIso, todayIso, todaySessions) ?')
    expect(read('../screens/DeckScreen.tsx')).toContain('canChangeDate(todayIso, todayIso, history.filter((s) => s.id !== api.session?.id))')
  })
})

describe('the draft message on the summary (D-074 rule 7)', () => {
  it('lists the keep offers that appear once the draft is cleared', () => {
    expect(keepOfferLines({ sets: [{ name: 'Leg press', n: 4 }], exercises: ['Barbell deadlift'], order: true })).toEqual([
      'Keep 4 sets of Leg press',
      'Keep Barbell deadlift in program',
      'Keep this order',
    ])
    expect(keepOfferLines({ sets: [], exercises: [], order: false })).toEqual([])
  })
  it('the Discard confirmation names what is discarded', () => {
    const edit = discardDraftConfirmation({ mode: 'edit', program: { name: 'Upper/Lower' }, updatedAt: '2026-09-20T12:00:00.000Z' })
    expect(edit.title).toBe('Discard your program draft?')
    expect(edit.body).toBe('Your unsaved builder changes to Upper/Lower, last changed Sun, Sep 20 are deleted. Upper/Lower stays as it is now.')
    expect(discardDraftConfirmation({ mode: 'new', program: { name: '' }, updatedAt: '' }).body).toBe(
      'The new program Untitled program you started in the builder is deleted. Your current program stays as it is.',
    )
  })
  it('Open draft goes to the builder; Discard clears the draft and shows the offers on the same summary', () => {
    const deck = read('../screens/DeckScreen.tsx')
    expect(deck).toContain("navigate(draftWaiting.mode === 'edit' ? '/program/edit' : '/program/new')")
    expect(deck).toContain('void clearDraft().then(() => setDraftWaiting(false))')
    expect(deck).toMatch(/>\s*Open draft\s*</)
    expect(deck).toMatch(/>\s*Discard draft\s*</)
  })
  it('only the builder writes the stored draft', () => {
    for (const f of ['../screens/DeckScreen.tsx', '../screens/WeekScreen.tsx', '../screens/LogHistory.tsx', '../program/ProgramProvider.tsx', './sessionExercises.ts', './todayPlan.ts']) {
      expect(read(f), f).not.toMatch(/writeDraft|builderDraft|setMeta\(DRAFT_KEY/)
    }
  })
})

describe('the page is not pulled past its ends (D-074 rule 8)', () => {
  const css = read('../index.css')
  it('overscroll-behavior: none on html and body', () => {
    expect(css).toMatch(/html,\s*body\s*\{[^}]*overscroll-behavior:\s*none;/)
  })
  it('the tab bar paints navy below itself, with no safe-area offsets', () => {
    expect(css).toMatch(/\.tabbar\s*\{[^}]*box-shadow:\s*0 120px 0 var\(--tabbar-bg\)/)
    expect(css).not.toContain('env(safe-area')
    expect(read('../../index.html')).not.toContain('viewport-fit=cover')
  })
})
