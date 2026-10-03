// EXEC-13-rework task 11: one body entry per date, stored (D-078 rule 1).
import 'fake-indexeddb/auto'

import { describe, expect, it } from 'vitest'

import { deleteBodyEntry, listBodyEntries, putBodyEntry } from '../src/db/index.ts'

describe('body entries in the database', () => {
  it('a new entry for the same date replaces it; delete removes it', async () => {
    await putBodyEntry({ date: '2026-10-03', units: 'kg', weight: 83, updatedAt: 'a' })
    await putBodyEntry({ date: '2026-10-03', units: 'kg', bodyFatPct: 22, updatedAt: 'b' })
    await putBodyEntry({ date: '2026-10-01', units: 'kg', weight: 83.2, updatedAt: 'c' })
    expect(await listBodyEntries()).toEqual([
      { date: '2026-10-01', units: 'kg', weight: 83.2, updatedAt: 'c' },
      { date: '2026-10-03', units: 'kg', bodyFatPct: 22, updatedAt: 'b' },
    ])
    await deleteBodyEntry('2026-10-01')
    expect((await listBodyEntries()).map((e) => e.date)).toEqual(['2026-10-03'])
  })
})
