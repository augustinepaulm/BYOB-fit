#!/usr/bin/env node
// D-066 rule 2: compile the program schema ahead of time, so nothing compiles a
// schema (with `new Function`) in the browser. Writes src/lib/validators.generated.js,
// or the path given as the first argument (scripts/verify.mjs uses a temporary
// file and compares). Run: node scripts/build-validators.mjs

import { readFileSync, writeFileSync } from 'node:fs'

import Ajv2020 from 'ajv/dist/2020.js'
import standaloneCode from 'ajv/dist/standalone/index.js'
import addFormats from 'ajv-formats'

const SCHEMA_PATH = 'docs/program.schema.json'
const DEFAULT_OUT = 'src/lib/validators.generated.js'

export function generateValidators() {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
  const id = schema.$id
  const ajv = new Ajv2020({ allErrors: true, strict: false, code: { source: true, esm: true } })
  addFormats(ajv)
  ajv.addSchema(schema)
  ajv.addSchema({ $ref: `${id}#/$defs/item` }, 'item')
  // D-038: an override carries itemFields properties only.
  ajv.addSchema({ $ref: `${id}#/$defs/itemFields`, unevaluatedProperties: false }, 'itemFields')
  let code = standaloneCode(ajv, { validateProgram: id, validateItem: 'item', validateItemFields: 'itemFields' })

  // Ajv's standalone output still calls require() for its runtime helpers, even
  // with esm: true. Each one becomes a namespace import with a .js path; the
  // property access after it (.default, .fullFormats.date) is kept.
  const imports = new Map()
  code = code.replace(/require\("([^"]+)"\)/g, (_, spec) => {
    const path = spec.endsWith('.js') ? spec : `${spec}.js`
    if (!imports.has(path)) imports.set(path, `__${imports.size}`)
    return `__cjs(${imports.get(path)})`
  })
  if (code.includes('require(')) throw new Error('a require() call was not rewritten')

  const header = [
    '// GENERATED FILE, do not edit. Written by scripts/build-validators.mjs from',
    `// ${SCHEMA_PATH} (D-066 rule 2); scripts/verify.mjs fails if it is out of date.`,
    ...[...imports].map(([path, name]) => `import * as ${name} from "${path}"`),
    '// The helpers are CommonJS. Some bundlers put their exports object under the',
    "// namespace's default (Vite's production build does); others spread it.",
    '// __cjs returns the exports object either way, so .default and .fullFormats',
    '// read the same thing everywhere.',
    'function __cjs(ns) { return ns.default && ns.default.__esModule ? ns.default : ns }',
    '',
  ].join('\n')
  return `${header}${code}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? DEFAULT_OUT
  writeFileSync(out, generateValidators())
  console.log(`wrote ${out}`)
}
