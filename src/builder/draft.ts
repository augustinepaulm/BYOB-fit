// The one builder draft (D-042 rule 1), kept in the meta store under
// builderDraft and written on every change, so it survives navigation and
// reload. Save or Discard clears it.

import { deleteMeta, getMeta, setMeta } from '../db/index.ts'
import type { Program } from '../types/program.ts'

export const DRAFT_KEY = 'builderDraft'

/** settings, days, day:<dayId> or review. */
export type DraftStep = 'settings' | 'days' | `day:${string}` | 'review'

export interface BuilderDraft {
  mode: 'new' | 'edit'
  program: Program
  step: DraftStep
  updatedAt: string
}

export async function readDraft(): Promise<BuilderDraft | null> {
  const raw = await getMeta(DRAFT_KEY)
  if (!raw) return null
  try {
    const draft = JSON.parse(raw) as BuilderDraft
    return draft && draft.program && (draft.mode === 'new' || draft.mode === 'edit') ? draft : null
  } catch {
    return null
  }
}

export async function writeDraft(draft: Omit<BuilderDraft, 'updatedAt'>): Promise<void> {
  const record: BuilderDraft = { ...draft, updatedAt: new Date().toISOString() }
  await setMeta(DRAFT_KEY, JSON.stringify(record))
}

export async function clearDraft(): Promise<void> {
  await deleteMeta(DRAFT_KEY)
}
