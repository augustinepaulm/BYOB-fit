// Today's plan inside the deck (D-063, D-065, EXEC-11.5 task 6): today's
// sections and items with their state, jump, reorder by handle or by Move up
// and Move down, and End. Viewing, jumping and moving change no set data.

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { prescriptionText } from '../lib/prescription.ts'
import type { DeckItem } from '../lib/session.ts'
import { stepTarget, type OrderEntry } from '../lib/todayPlan.ts'
import { HandleIcon, TickIcon } from '../onboarding/ui.tsx'

interface Group {
  sectionId: string
  title: string
  items: { deckItem: DeckItem; index: number }[]
}

/** Consecutive items of one section form a group; empty sections never show. */
function groupsOf(deck: DeckItem[]): Group[] {
  const groups: Group[] = []
  deck.forEach((deckItem, index) => {
    const last = groups[groups.length - 1]
    if (last && last.sectionId === deckItem.section.id) last.items.push({ deckItem, index })
    else groups.push({ sectionId: deckItem.section.id, title: deckItem.section.title, items: [{ deckItem, index }] })
  })
  return groups
}

export function PlanSheet({
  deck,
  order,
  currentIndex,
  done,
  nameOf,
  onJump,
  onMove,
  onEnd,
  onClose,
}: {
  deck: DeckItem[]
  order: OrderEntry[]
  currentIndex: number
  /** Item ids that are done; they never move (D-065 rule 4). */
  done: ReadonlySet<string>
  nameOf: (deckItem: DeckItem) => string
  onJump: (index: number) => void
  onMove: (itemId: string, toIndex: number, toSectionId: string) => void
  onEnd: () => void
  onClose: () => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ itemId: string; startY: number; dy: number } | null>(null)

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
    setDrag({ itemId, startY: event.clientY, dy: 0 })
  }

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
          {groupsOf(deck).map((group, g) => (
            <div key={`${group.sectionId}-${g}`}>
              <div className="ob-sechead dk-plan__section" data-section-id={group.sectionId}>
                <span>{group.title}</span>
                <span style={{ fontWeight: 500, color: 'var(--secondary)' }}>{group.items.length}</span>
              </div>
              {group.items.map(({ deckItem, index }) => {
                const id = deckItem.item.id
                const name = nameOf(deckItem)
                const isDone = done.has(id)
                const state = isDone ? 'Done' : index === currentIndex ? 'Current' : 'Upcoming'
                const up = isDone ? null : stepTarget(order, id, 'up')
                const down = isDone ? null : stepTarget(order, id, 'down')
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
                          if (drag?.itemId !== id) return
                          const target = dropTarget(id, event.clientY)
                          setDrag(null)
                          if (Math.abs(event.clientY - drag.startY) > 4) onMove(id, target.toIndex, target.toSectionId)
                        }}
                        onPointerCancel={() => setDrag(null)}
                      >
                        <HandleIcon />
                      </button>
                    )}
                    <button type="button" className="dk-plan__name" onClick={() => onJump(index)}>
                      <span className="dk-plan__title">{name}</span>
                      <span className="dk-plan__sub">{prescriptionText(deckItem.resolved)}</span>
                    </button>
                    <span className={`dk-plan__state dk-plan__state--${state.toLowerCase()}`}>
                      {isDone && <TickIcon />}
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
          <button type="button" className="ob-outline dk-plan__end" onClick={onEnd}>
            End session
          </button>
        </div>
      </div>
    </>
  )
}
