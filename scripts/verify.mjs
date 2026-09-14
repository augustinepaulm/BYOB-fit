#!/usr/bin/env node
// npm run verify: lint, tests, build, then the integrity evidence Gate reviews
// need — md5 of every contract file and proof that no private seed data is
// tracked. Exits non-zero on the first failure.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
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

step('lint', 'npm', ['run', 'lint'])
step('tests', 'npx', ['vitest', 'run'])
step('build', 'npm', ['run', 'build'])

console.log('\n=== md5 ===')
const files = readdirSync('docs')
  .map((name) => join('docs', name))
  .filter((path) => statSync(path).isFile())
  .sort()
files.push('public/sample-program.json')
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
