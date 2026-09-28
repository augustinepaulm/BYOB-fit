/// <reference types="node" />
// EXEC-11 task 5: the safety notice in Settings (5j) is the onboarding step 3
// (1c) wording, from one source, and matches the approved design text (D-029).
import { readFileSync } from 'node:fs'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SAFETY_STOP, SAFETY_NOTICE, SAFETY_TITLE, SafetyNotice } from './safety.tsx'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const onboarding = read('../screens/OnboardingScreen.tsx')
const about = read('../screens/AboutScreens.tsx')
const design = read('../../design/BYOB-fit_v2_design.dc.html')

/** The frame's HTML, from its anchor to the next frame. */
function frame(id: string): string {
  const start = design.indexOf(`<div class="dv-opt" id="${id}">`)
  if (start < 0) throw new Error(`missing frame ${id}`)
  const end = design.indexOf('<div class="dv-opt" id="', start + 10)
  return design.slice(start, end < 0 ? undefined : end)
}

describe('safety notice (D-029, D-050 rule 4)', () => {
  it('onboarding step 3 and Settings render the same component and title', () => {
    for (const source of [onboarding, about]) {
      expect(source).toContain('<SafetyNotice />')
      expect(source).toContain('{SAFETY_TITLE}')
      // No second copy of the wording anywhere else.
      expect(source).not.toContain('is not medical advice')
      expect(source).not.toContain('severe breathlessness')
    }
  })

  it('renders exactly the approved text', () => {
    const html = renderToStaticMarkup(createElement(SafetyNotice))
    expect(html).toBe(`<div class="ob-notice">${SAFETY_NOTICE}</div><div class="ob-notice ob-notice--stop">${SAFETY_STOP}</div>`)
  })

  it('matches frames 1c and 5j, light and dark', () => {
    for (const id of ['1c', '1c-dark', '5j', '5j-dark']) {
      const html = frame(id)
      expect(html).toContain(SAFETY_TITLE)
      expect(html).toContain(SAFETY_NOTICE)
      expect(html).toContain(SAFETY_STOP)
    }
  })
})
