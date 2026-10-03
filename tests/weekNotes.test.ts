// EXEC-13-rework task 14: notes are stored per week and listed newest first.
import 'fake-indexeddb/auto'

import { describe, expect, it } from 'vitest'

import { addWeekNote, listWeekNotes } from '../src/db/index.ts'
import { newWeekNote } from '../src/lib/weekNotes.ts'

describe('weekNotes store', () => {
  it('keeps every note; listing a week returns its notes newest first', async () => {
    await addWeekNote(newWeekNote({ weekStart: '2026-09-27', view: 'training', reply: 'One.' }, new Date('2026-10-03T09:00:00Z')))
    await addWeekNote(newWeekNote({ weekStart: '2026-09-27', view: 'body', reply: 'Two.' }, new Date('2026-10-03T10:00:00Z')))
    await addWeekNote(newWeekNote({ weekStart: '2026-09-20', view: 'training', reply: 'Old.' }, new Date('2026-09-27T10:00:00Z')))
    expect((await listWeekNotes('2026-09-27')).map((n) => n.reply)).toEqual(['Two.', 'One.'])
    expect((await listWeekNotes('2026-09-20')).map((n) => n.reply)).toEqual(['Old.'])
  })
})
