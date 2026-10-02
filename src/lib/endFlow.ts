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
