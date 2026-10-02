/// <reference types="node" />
// EXEC-11.6 task 9 (D-066 rule 2): the precompiled validators accept every
// shipped program, reject broken copies, keep import's error text exactly as it
// was with the runtime compiler, and nothing in src/ compiles a schema.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import sample from '../../public/sample-program.json'
import fullBody from '../../public/templates/starter-3day-fullbody.json'
import upperLower from '../../public/templates/starter-4day-upper-lower.json'
import split from '../../public/templates/starter-5day-split.json'
import { importProgramText } from './importProgram.ts'
import { validateProgram } from './validators.generated.js'

type Doc = Record<string, unknown> & { days: { sections: { items: Record<string, unknown>[] }[] }[] }

/** The first item of the first day that has one. */
function firstItem(doc: Doc): Record<string, unknown> {
  for (const day of doc.days) for (const section of day.sections) if (section.items[0]) return section.items[0]
  throw new Error('no items')
}

const PROGRAMS: [string, unknown][] = [
  ['sample program', sample],
  ['3-day starter', fullBody],
  ['4-day starter', upperLower],
  ['5-day starter', split],
]

describe('validateProgram (precompiled)', () => {
  for (const [name, program] of PROGRAMS) {
    it(`accepts the ${name}, and rejects a bad item type or a bad startDate`, () => {
      expect(validateProgram(program)).toBe(true)
      const badType = structuredClone(program) as Doc
      firstItem(badType).type = 'squat_jumps'
      expect(validateProgram(badType)).toBe(false)
      expect(validateProgram.errors?.some((e) => e.keyword === 'enum' && e.instancePath.endsWith('/type'))).toBe(true)
      const badDate = structuredClone(program) as Doc
      badDate.startDate = '2026-13-45'
      expect(validateProgram(badDate)).toBe(false)
      expect(validateProgram.errors?.some((e) => e.keyword === 'format' && e.instancePath === '/startDate')).toBe(true)
    })
  }
})

describe('importProgram error text is unchanged from main (67ddd3d)', () => {
  // Captured on main, before the validators changed (EXEC-11.6 task 9).
  const MAIN: Record<string, string[]> = {
    missingStart: ['/: missing required property "startDate"'],
    wrongType: ['/days/1/sections/1/items/0/type: must be one of ["load_reps","bodyweight_reps","timed_hold","distance","cardio_block","check"]'],
    extra: ['/: unknown property "colour"'],
    badDate: ['/startDate: must match format "date"'],
  }
  const base = () => structuredClone(sample) as unknown as Doc
  const files: Record<string, Doc> = {}
  files.missingStart = base()
  delete files.missingStart.startDate
  files.wrongType = base()
  files.wrongType.days[1].sections[1].items[0].type = 'squat_jumps'
  files.extra = base()
  files.extra.colour = 'blue'
  files.badDate = base()
  files.badDate.startDate = '2026-13-45'

  for (const [name, expected] of Object.entries(MAIN)) {
    it(name, () => {
      const result = importProgramText(JSON.stringify(files[name]))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors).toEqual(expected)
    })
  }

  it('the sample still imports', () => {
    expect(importProgramText(JSON.stringify(sample)).ok).toBe(true)
  })
})

describe('no schema compiled at runtime (D-066 rule 2)', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return sources(path)
      return /\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : []
    })
  }
  it('src/ has no new Ajv, .compile( or require(, outside test files', () => {
    const src = new URL('..', import.meta.url).pathname
    const offenders = sources(src).filter((path) => /new Ajv|\.compile\(|require\(/.test(readFileSync(path, 'utf8')))
    expect(offenders).toEqual([])
  })
})
