// Today's plan inside the deck (D-063, D-065, EXEC-11.5 task 6): today's
// sections and items with their state, jump, reorder by handle or by Move up
// and Move down, and End. Viewing, jumping and moving change no set data.
// D-069: sections emptied today stay as drop targets (rule 11), and "Change
// today's workout" (rule 5).

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { prescriptionText } from '../lib/prescription.ts'
import type { DeckItem } from '../lib/session.ts'
import { planGroups, stepInGroups, type OrderEntry } from '../lib/todayPlan.ts'
import { HandleIcon, TickIcon } from '../onboarding/ui.tsx'

export function PlanSheet({
  deck,
  order,
  currentIndex,
  done,
  inProgress,
  nameOf,
  sections,
  onJump,
  onMove,
  onChangeDay,
  onAddExercise,
  onEnd,
  onClose,
}: {
  deck: DeckItem[]
  /** The day's sections in program order; empty ones stay as drop targets. */
  sections: readonly { id: string; title: string }[]
  order: OrderEntry[]
  currentIndex: number
  /** Item ids that are done; they never move (D-065 rule 4). */
  done: ReadonlySet<string>
  /** Done items with only some sets saved show as in progress (D-074 rule 1). */
  inProgress: ReadonlySet<string>
  nameOf: (deckItem: DeckItem) => string
  onJump: (index: number) => void
  onMove: (itemId: string, toIndex: number, toSectionId: string) => void
  /** D-069 rule 5: Change today's workout; null when today has a finished session (D-074 rule 6). */
  onChangeDay: (() => void) | null
  /** D-069 rule 7: Add exercise. */
  onAddExercise: () => void
  onEnd: () => void
  onClose: () => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const groups = planGroups(deck, sections)
  const [drag, setDrag] = useState<{ itemId: string; startY: number; dy: number } | null>(null)
  // The handle holding the pointer during a drag (D-074 rule 2).
  const captured = useRef<{ element: HTMLElement; pointerId: number } | null>(null)

  /** Where a drop at clientY lands: the index among the other items, and the section. */
  function dropTarget(itemId: string, clientY: number): { toIndex: number; toSectionId: string } {
    const elements = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-section-id]') ?? [])].filter((el) => el.dataset.itemId !== itemId)
    let toIndex = 0
    let toSectionId = elements[0]?.dataset.sectionId ?? order[0]?.sectionId ?? ''
    for (const el of elements) {
      const rect = el.getBoundingClientRect()
      if (rect.top >= clientY) break
      toSectionId = el.dataset.sectionId ?? toSectionId
      if (el.dataset.itemId && rect.top + rect.height / 2 < clientY) toIndex += 1
    }
    return { toIndex, toSectionId }
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, itemId: string) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    captured.current = { element: event.currentTarget, pointerId: event.pointerId }
    setDrag({ itemId, startY: event.clientY, dy: 0 })
  }

  /** D-074 rule 2: release the pointer and clear the drag, so nothing blocks the next scroll. */
  function endDrag() {
    const held = captured.current
    captured.current = null
    if (held) {
      try {
        if (held.element.hasPointerCapture(held.pointerId)) held.element.releasePointerCapture(held.pointerId)
      } catch {
        // The element is gone or the pointer already ended.
      }
    }
    setDrag(null)
  }
  // Closing the sheet mid-drag releases it too.
  useEffect(() => () => {
    const held = captured.current
    captured.current = null
    try {
      if (held?.element.hasPointerCapture(held.pointerId)) held.element.releasePointerCapture(held.pointerId)
    } catch {
      // Already released.
    }
  }, [])

  return (
    <>
      <div className="bd-scrim" onClick={onClose} />
      <div className="bd-sheet dk-plan" role="dialog" aria-modal="true" aria-label="Today's plan">
        <div className="bd-sheet__grab" />
        <div className="dk-plan__head">
          <h2 className="bd-sheet__title">Today&apos;s plan</h2>
          <button type="button" className="dk-plan__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dk-plan__list" ref={listRef}>
          {groups.map((group, g) => (
            <div key={`${group.sectionId}-${g}`}>
              <div className="ob-sechead dk-plan__section" data-section-id={group.sectionId}>
                <span>{group.title}</span>
                <span style={{ fontWeight: 500, color: 'var(--secondary)' }}>{group.items.length}</span>
              </div>
              {group.items.length === 0 && <div className="dk-plan__empty">Nothing here today. Move an item here.</div>}
              {group.items.map(({ deckItem, index }) => {
                const id = deckItem.item.id
                const name = nameOf(deckItem)
                const isDone = done.has(id)
                const partly = inProgress.has(id)
                const state = isDone && !partly ? 'Done' : index === currentIndex ? 'Current' : partly ? 'In progress' : 'Upcoming'
                const up = isDone ? null : stepInGroups(groups, id, 'up')
                const down = isDone ? null : stepInGroups(groups, id, 'down')
                const dragging = drag?.itemId === id
                return (
                  <div
                    key={id}
                    className={`dk-plan__row${index === currentIndex ? ' dk-plan__row--current' : ''}${dragging ? ' dk-plan__row--dragging' : ''}`}
                    data-item-id={id}
                    data-section-id={deckItem.section.id}
                    style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
                  >
                    {isDone ? (
                      <span className="dk-plan__handle dk-plan__handle--off" aria-hidden="true" />
                    ) : (
                      <button
                        type="button"
                        className="dk-plan__handle"
                        aria-label={`Drag ${name}`}
                        onPointerDown={(event) => startDrag(event, id)}
                        onPointerMove={(event) => drag?.itemId === id && setDrag({ ...drag, dy: event.clientY - drag.startY })}
                        onPointerUp={(event) => {
                          if (drag?.itemId !== id) return endDrag()
                          const target = dropTarget(id, event.clientY)
                          endDrag()
                          if (Math.abs(event.clientY - drag.startY) > 4) onMove(id, target.toIndex, target.toSectionId)
                        }}
                        onPointerCancel={endDrag}
                        onLostPointerCapture={() => drag && endDrag()}
                      >
                        <HandleIcon />
                      </button>
                    )}
                    <button type="button" className="dk-plan__name" onClick={() => onJump(index)}>
                      <span className="dk-plan__title">{name}</span>
                      <span className="dk-plan__sub">{prescriptionText(deckItem.resolved)}</span>
                    </button>
                    <span className={`dk-plan__state dk-plan__state--${state.toLowerCase().replace(' ', '')}`}>
                      {state === 'Done' && <TickIcon />}
                      {state}
                    </span>
                    {!isDone && (
                      <span className="dk-plan__moves">
                        <button type="button" aria-label={`Move ${name} up`} disabled={!up} onClick={() => up && onMove(id, up.toIndex, up.toSectionId)}>
                          ↑
                        </button>
                        <button type="button" aria-label={`Move ${name} down`} disabled={!down} onClick={() => down && onMove(id, down.toIndex, down.toSectionId)}>
                          ↓
                        </button>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="bd-sheet__actions">
          <button type="button" className="ob-outline" onClick={onAddExercise}>
            Add exercise
          </button>
          {onChangeDay && (
            <button type="button" className="ob-outline" onClick={onChangeDay}>
              Change today&apos;s workout
            </button>
          )}
          <button type="button" className="ob-outline dk-plan__end" onClick={onEnd}>
            End session
          </button>
        </div>
      </div>
    </>
  )
}
