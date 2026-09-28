// Opens the forms path: resumes the stored draft when there is one (D-042
// rule 1), otherwise starts a new program or an edit of the given program.

import { useEffect, useState } from 'react'

import { getProgram, listAllSessions, listPrograms } from '../db/index.ts'
import { blankProgram, loadDraft } from '../lib/builder.ts'
import { toISODate } from '../lib/dates.ts'
import { sundayOnOrBefore, uniqueProgramId } from '../lib/onboarding.ts'
import type { LoadUnit, Program } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { readDraft, type BuilderDraft } from './draft.ts'
import { FormsBuilder } from './FormsBuilder.tsx'

interface Loaded {
  draft: BuilderDraft
  original: Program | null
  sessions: Session[]
}

export function BuilderEntry({
  mode,
  editing,
  today,
  currentWeek,
  unit,
  beginnerDefault,
  onSave,
  onExit,
  onDiscarded,
}: {
  mode: 'new' | 'edit'
  /** The program to edit when mode is edit and no draft is waiting. */
  editing: Program | null
  today: Date
  currentWeek: number
  unit: LoadUnit
  beginnerDefault: boolean
  /** Receives the finished program and the mode it was built in. */
  onSave: (program: Program, mode: 'new' | 'edit') => Promise<void>
  onExit: () => void
  onDiscarded: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      const sessions = await listAllSessions()
      const waiting = await readDraft()
      let draft: BuilderDraft
      if (waiting) {
        draft = waiting
      } else if (mode === 'edit' && editing) {
        draft = { mode: 'edit', program: loadDraft(editing), step: 'settings', updatedAt: '' }
      } else {
        const ids = (await listPrograms()).map((p) => p.id)
        const start = toISODate(sundayOnOrBefore(today))
        draft = { mode: 'new', program: blankProgram(uniqueProgramId('my-program', ids), start), step: 'settings', updatedAt: '' }
      }
      const original = draft.mode === 'edit' ? ((await getProgram(draft.program.id)) ?? null) : null
      if (live) setLoaded({ draft, original, sessions })
    })()
    return () => {
      live = false
    }
  }, [mode, editing, today])

  if (!loaded) return null
  return (
    <FormsBuilder
      initial={loaded.draft}
      original={loaded.original}
      currentWeek={loaded.draft.mode === 'edit' ? currentWeek : 1}
      sessions={loaded.sessions}
      today={today}
      unit={unit}
      beginnerDefault={beginnerDefault}
      onSave={(program) => onSave(program, loaded.draft.mode)}
      onExit={onExit}
      onDiscarded={onDiscarded}
    />
  )
}
