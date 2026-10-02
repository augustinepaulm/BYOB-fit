#!/usr/bin/env node
// npm run verify: lint, tests, build, then the integrity evidence Gate reviews
// need — md5 of every contract file and proof that no private seed data is
// tracked. Exits non-zero on the first failure.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let failed = false

function step(title, command, args) {
  console.log(`\n=== ${title} ===`)
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (result.status !== 0) {
    console.error(`FAIL: ${title} exited ${result.status ?? 'with a signal'}`)
    failed = true
  }
  return result.status === 0
}

function md5(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex')
}

// D-066 rule 2: the committed validators must be what the schema generates.
console.log('\n=== validators ===')
{
  const dir = mkdtempSync(join(tmpdir(), 'byob-validators-'))
  const fresh = join(dir, 'validators.generated.js')
  const result = spawnSync('node', ['scripts/build-validators.mjs', fresh], { stdio: 'inherit' })
  const committed = 'src/lib/validators.generated.js'
  if (result.status !== 0) {
    console.error('FAIL: scripts/build-validators.mjs did not run')
    failed = true
  } else if (readFileSync(fresh, 'utf8') !== readFileSync(committed, 'utf8')) {
    console.error(`FAIL: ${committed} differs from what scripts/build-validators.mjs generates; run it and commit the result`)
    failed = true
  } else {
    console.log(`${committed} matches a fresh generation`)
  }
  rmSync(dir, { recursive: true, force: true })
}

step('lint', 'npm', ['run', 'lint'])
step('tests', 'npx', ['vitest', 'run'])
step('build', 'npm', ['run', 'build'])

console.log('\n=== md5 ===')
const files = readdirSync('docs')
  .map((name) => join('docs', name))
  .filter((path) => statSync(path).isFile())
  .sort()
files.push('public/sample-program.json')
files.push(
  ...readdirSync('public/templates')
    .map((name) => join('public/templates', name))
    .filter((path) => statSync(path).isFile())
    .sort(),
)
files.push(
  ...readdirSync('design')
    .map((name) => join('design', name))
    .filter((path) => statSync(path).isFile())
    .sort(),
)
for (const path of files) {
  console.log(`${md5(path)}  ${path}`)
}

console.log('\n=== git ls-files seed/ ===')
const tracked = spawnSync('git', ['ls-files', 'seed/'], { encoding: 'utf8' })
const lines = tracked.stdout.split('\n').filter(Boolean)
for (const line of lines) console.log(line)
if (lines.length !== 1 || lines[0] !== 'seed/README.md') {
  console.error(
    `FAIL: seed/ must track only seed/README.md, found: ${lines.join(', ') || '(nothing)'}`,
  )
  failed = true
}

console.log(`\n=== verify ${failed ? 'FAILED' : 'OK'} ===`)
process.exit(failed ? 1 : 0)
