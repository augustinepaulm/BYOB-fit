// End during a session (D-067 rule 2): close the keyboard first, then confirm
// over the screen when anything is not done, or go straight to the summary.

/** The set box with focus loses it, so the keyboard closes; true when one did. */
export function blurSetBox(doc: { activeElement: Element | null }): boolean {
  const active = doc.activeElement as (Element & { dataset?: DOMStringMap; blur?: () => void }) | null
  if (!active?.dataset || !('setBox' in active.dataset) || typeof active.blur !== 'function') return false
  active.blur()
  return true
}

/** With items not done, End asks first; with none, it goes to the summary. */
export function endStep(notDone: number): 'confirm' | 'summary' {
  return notDone > 0 ? 'confirm' : 'summary'
}

/** One done item for the End dialog's body. */
export interface DoneItem {
  name: string
  /** Confirmed sets of a logged item; undefined for a checked item. */
  sets?: number
  warmup?: boolean
}

/**
 * Frame 2.11's body: what has been done, and that it is kept. With nothing
 * done, ending deletes the session and leaves the day open (D-086).
 */
export function endDialogBody(done: DoneItem[]): string {
  if (done.length === 0) return "Nothing is logged yet, so ending leaves today open."
  const warmup = done.some((d) => d.warmup)
  const rest = done.filter((d) => !d.warmup)
  const totalSets = rest.reduce((n, d) => n + (d.sets ?? 0), 0)
  const parts = [
    ...(warmup ? ['the warm-up'] : []),
    ...rest.map((d) => (d.sets !== undefined ? `${d.sets} ${d.sets === 1 ? 'set' : 'sets'} of ${d.name}` : d.name)),
  ]
  const list =
    parts.length > 3
      ? `${totalSets} ${totalSets === 1 ? 'set' : 'sets'} across ${rest.length} ${rest.length === 1 ? 'exercise' : 'exercises'}${warmup ? ', and the warm-up' : ''}`
      : parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `You've done ${list}. Everything logged so far is kept.`
}
