/// <reference types="node" />
// Vitest blanks CSS imports, so the stylesheet is read from disk.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

/** Property → value pairs inside the first block that starts at `opener`. */
function declarations(opener: string): Map<string, string> {
  const start = css.indexOf(opener)
  if (start < 0) throw new Error(`missing block: ${opener}`)
  const body = css.slice(start + opener.length, css.indexOf('}', start))
  const pairs = new Map<string, string>()
  for (const line of body.split(';')) {
    const at = line.indexOf(':')
    if (at < 0) continue
    const property = line.slice(0, at).trim()
    if (property.startsWith('--')) pairs.set(property, line.slice(at + 1).trim())
  }
  return pairs
}

describe('dark tokens (D-039, EXEC-07.1 task 5)', () => {
  const system = declarations('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {')
  const override = declarations(':root[data-theme="dark"] {')

  it('finds the dark palette in both blocks', () => {
    expect(system.size).toBeGreaterThan(30)
  })

  it('keeps the System-dark and Dark override declarations identical', () => {
    expect([...override.entries()].sort()).toEqual([...system.entries()].sort())
  })
})

describe('literal colours outside the token blocks (EXEC-11 task 10)', () => {
  it('theme-color values equal the Ground tokens', async () => {
    const { GROUND } = await import('./appearance.ts')
    expect(declarations(':root {').get('--bg')).toBe(GROUND.light)
    expect(declarations(':root[data-theme="dark"] {').get('--bg')).toBe(GROUND.dark)
  })

  it('no colour literal outside :root and the two dark blocks', () => {
    const end = css.indexOf('}', css.indexOf(':root[data-theme="dark"] {'))
    const rest = css.slice(end + 1)
    expect(rest.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []).toEqual([])
  })
})
