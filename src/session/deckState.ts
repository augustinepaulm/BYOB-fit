// D-077 rule 4: leaving the deck loses nothing. The rest timer's end time,
// typed but unsaved set boxes and where the user was are kept in `meta`,
// keyed by session, and restored when the deck reopens (even after the app
// was closed). The in-progress bar reads the same record.

import { deleteMeta, getMeta, setMeta } from '../db/index.ts'

export interface DeckState {
  sessionId: string
  /** Epoch ms when the running rest ends; null when no rest is running. */
  restUntil: number | null
  /** The rest's full length in seconds, for the bar's ring. */
  restSec?: number
  /** Typed, unsaved box text keyed as the deck keys its boxes. */
  drafts: Record<string, string>
  /** The deck position the user was on; null until they moved. */
  position: number | null
  /** What the in-progress bar shows under the workout, e.g. "Bench press, set 2 next". */
  label?: string
}

export const DECK_STATE_PREFIX = 'deck:'

export function deckStateKey(sessionId: string): string {
  return `${DECK_STATE_PREFIX}${sessionId}`
}

/** Parse a stored record; anything malformed reads as nothing kept. */
export function parseDeckState(sessionId: string, raw: string | undefined): DeckState | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<DeckState>
    if (value.sessionId !== sessionId) return null
    return {
      sessionId,
      restUntil: typeof value.restUntil === 'number' ? value.restUntil : null,
      ...(typeof value.restSec === 'number' ? { restSec: value.restSec } : {}),
      drafts: value.drafts && typeof value.drafts === 'object' ? (value.drafts as Record<string, string>) : {},
      position: typeof value.position === 'number' ? value.position : null,
      ...(typeof value.label === 'string' ? { label: value.label } : {}),
    }
  } catch {
    return null
  }
}

export async function readDeckState(sessionId: string): Promise<DeckState | null> {
  return parseDeckState(sessionId, await getMeta(deckStateKey(sessionId)))
}

export async function writeDeckState(state: DeckState): Promise<void> {
  await setMeta(deckStateKey(state.sessionId), JSON.stringify(state))
  notifyDeckState()
}

export async function clearDeckState(sessionId: string): Promise<void> {
  await deleteMeta(deckStateKey(sessionId))
  notifyDeckState()
}

// The in-progress bar listens for changes made while the app is open.
const listeners = new Set<() => void>()

export function onDeckStateChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyDeckState() {
  for (const listener of listeners) listener()
}
