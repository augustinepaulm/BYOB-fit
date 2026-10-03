/// <reference types="node" />
// EXEC-11.7 task 7 (D-067 rule 2): End closes the keyboard, then confirms in a
// dialog when items are not done, or goes to the summary; Keep going changes
// nothing; Plan and End have 44 × 44 tap areas 8 px apart. The deck needs
// IndexedDB and a router to render, so its wiring is checked in the source and
// its behaviour in the scripted browser run.
import { readFileSync } from 'node:fs'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { Dialog } from '../ui/Dialog.tsx'
import { blurSetBox, endDialogBody, endStep } from './endFlow.ts'

const deck = readFileSync(new URL('../screens/DeckScreen.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8') + readFileSync(new URL('../ui/v3.css', import.meta.url), 'utf8')

/** Declarations of the first rule that starts with `selector {`. */
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`missing rule ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

describe('End (D-067 rule 2)', () => {
  it('asks when items are not done, goes to the summary when none are', () => {
    expect(endStep(3)).toBe('confirm')
    expect(endStep(1)).toBe('confirm')
    expect(endStep(0)).toBe('summary')
  })

  it('a focused set box is blurred first; anything else is left alone', () => {
    const blur = vi.fn()
    expect(blurSetBox({ activeElement: { dataset: { setBox: '' }, blur } as unknown as Element })).toBe(true)
    expect(blur).toHaveBeenCalledOnce()
    const other = vi.fn()
    expect(blurSetBox({ activeElement: { dataset: {}, blur: other } as unknown as Element })).toBe(false)
    expect(other).not.toHaveBeenCalled()
    expect(blurSetBox({ activeElement: null })).toBe(false)
  })

  it('the deck blurs before deciding, and confirms with the Dialog, not an inline block', () => {
    const endFlow = deck.slice(deck.indexOf('const endFlow = () => {'), deck.indexOf('const moveInPlan'))
    expect(endFlow.indexOf('blurSetBox(document)')).toBeGreaterThan(-1)
    expect(endFlow.indexOf('blurSetBox(document)')).toBeLessThan(endFlow.indexOf('endStep(notDone)'))
    // EXEC-13-rework: frame 2.11's copy, "End this workout?".
    expect(deck).not.toMatch(/StateBlock[\s\S]{0,120}title="End this workout\?"/)
    expect(deck.match(/title="End this workout\?"/g)).toHaveLength(1)
    expect(deck).toMatch(/<Dialog\s+title="End this workout\?"/)
  })

  it('Keep going only closes the dialog, so the deck is unchanged', () => {
    const start = deck.lastIndexOf('<Dialog', deck.indexOf('title="End this workout?"'))
    const dialog = deck.slice(start, deck.indexOf('/>', start))
    expect(dialog).toContain('cancelLabel="Keep going"')
    expect(dialog).toContain('onCancel={() => setEndAsked(false)}')
    expect(dialog).toContain('confirmLabel="End workout"')
  })

  it('the dialog reads "End this workout?" with Keep going and End workout (frame 2.11)', () => {
    const html = renderToStaticMarkup(
      createElement(Dialog, {
        title: 'End this workout?',
        body: endDialogBody([{ name: 'rower', warmup: true }, { name: 'bench press', sets: 1 }]),
        cancelLabel: 'Keep going',
        confirmLabel: 'End workout',
        danger: true,
        onConfirm: () => undefined,
        onCancel: () => undefined,
      }),
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('You&#x27;ve done the warm-up and 1 set of bench press. Everything logged so far is kept.')
    expect(html.indexOf('Keep going')).toBeLessThan(html.indexOf('End workout'))
  })

  it('the body names what was done, and says when nothing was', () => {
    expect(endDialogBody([])).toBe('Nothing is logged yet, so ending leaves today open.')
    expect(endDialogBody([{ name: 'bench press', sets: 3 }, { name: 'plank' }])).toBe("You've done 3 sets of bench press and plank. Everything logged so far is kept.")
    expect(endDialogBody([{ name: 'a', sets: 2 }, { name: 'b', sets: 3 }, { name: 'c', sets: 1 }, { name: 'd', sets: 4 }, { name: 'w', warmup: true }])).toBe(
      "You've done 10 sets across 4 exercises, and the warm-up. Everything logged so far is kept.",
    )
  })
})

describe('deck header tap areas (D-067 rule 2a)', () => {
  it('Plan and End are at least 44 × 44, and End sits 8 px from Plan', () => {
    // EXEC-13-rework: Plan is the v3 pill (34 px drawn, 44 px tap area); End keeps its rule.
    expect(rule('.pill-action::after')).toMatch(/inset: -5px 0/)
    for (const selector of ['.dk-end']) {
      expect(rule(selector)).toMatch(/min-width: 44px/)
      expect(rule(selector)).toMatch(/min-height: 44px/)
    }
    expect(rule('.dk-end')).toMatch(/margin-left: 8px/)
    // In the header, Plan comes right before End.
    expect(deck.indexOf('className="pill-action" aria-label="Today\'s plan"')).toBeLessThan(deck.indexOf('className="dk-end"'))
  })
})
