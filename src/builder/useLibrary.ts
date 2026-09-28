// Starter templates and the picker's exercise library (D-037, D-042 rule 7).

import { useEffect, useMemo, useState } from 'react'

import { listPrograms } from '../db/index.ts'
import { exerciseLibrary, type LibraryEntry } from '../lib/builder.ts'
import { importProgramText } from '../lib/importProgram.ts'
import { STARTER_TEMPLATES } from '../lib/onboarding.ts'
import type { Program } from '../types/program.ts'

export interface LoadedTemplate {
  file: string
  level: string
  program: Program
}

/** The three starter programs from public/templates/ (precached for offline). */
export function useStarterTemplates(): { templates: LoadedTemplate[] | null; error: string | null } {
  const [templates, setTemplates] = useState<LoadedTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void Promise.all(
      STARTER_TEMPLATES.map(async (t) => {
        const response = await fetch(`${import.meta.env.BASE_URL}templates/${t.file}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = importProgramText(await response.text())
        if (!result.ok) throw new Error(result.errors[0])
        return { file: t.file, level: t.level, program: result.program }
      }),
    ).then(
      (loaded) => live && setTemplates(loaded),
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [])
  return { templates, error }
}

/** Starter exercises, then stored programs', then the draft's own (custom ones). */
export function useLibrary(draft: Program | null, templates: LoadedTemplate[] | null): LibraryEntry[] {
  const [stored, setStored] = useState<Program[]>([])
  useEffect(() => {
    let live = true
    void listPrograms().then((found) => live && setStored(found))
    return () => {
      live = false
    }
  }, [])
  return useMemo(
    () =>
      exerciseLibrary(
        (templates ?? []).map((t) => t.program),
        draft ? [...stored, draft] : stored,
      ),
    [templates, stored, draft],
  )
}
