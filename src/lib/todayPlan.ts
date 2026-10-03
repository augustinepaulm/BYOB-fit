// Today's plan inside the deck (D-063, D-065, EXEC-11.5): today's order of
// items and sections, moves, the current item after a move, added sets, and
// the two summary actions that write back to the program. Pure functions.

import type { Day, Item, Program } from '../types/program.ts'
import type { Entry, Session } from '../types/stores.ts'
import { finishDraft, loadDraft } from './builder.ts'
import { isLogged } from './program.ts'
import { findEntry, findSet, isSetConfirmed, setRowsFor, type DeckItem, type SetRow } from './session.ts'

/** One item in today's order and the section it sits in today (D-065 rule 1). */
export interface OrderEntry {
  itemId: string
  sectionId: string
}

// ── a. Today's order applied to the deck ──

/**
 * Listed items first, in listed order, each in its listed section; unlisted
 * items after them at their program position in their program section; listed
 * ids that are not in today's deck are ignored. Every item keeps the `logged`
 * value from its program section (D-065 rule 2). Positions are renumbered.
 */
export function applyOrder(deck: DeckItem[], day: Day, order: OrderEntry[] | undefined): DeckItem[] {
  if (!order?.length) return deck
  const byId = new Map(deck.map((d) => [d.item.id, d]))
  const sections = new Map(day.sections.map((s) => [s.id, s]))
  const out: DeckItem[] = []
  const seen = new Set<string>()
  for (const { itemId, sectionId } of order) {
    const deckItem = byId.get(itemId)
    if (!deckItem || seen.has(itemId)) continue
    seen.add(itemId)
    out.push({ ...deckItem, section: sections.get(sectionId) ?? deckItem.section })
  }
  for (const deckItem of deck) if (!seen.has(deckItem.item.id)) out.push(deckItem)
  return out.map((d, i) => ({ ...d, position: i + 1 }))
}

/** The deck as an order list. */
export function orderOf(deck: DeckItem[]): OrderEntry[] {
  return deck.map((d) => ({ itemId: d.item.id, sectionId: d.section.id }))
}

/** Whether today's order differs from the program's (item order or any section). */
export function orderDiffers(today: DeckItem[], program: DeckItem[]): boolean {
  return JSON.stringify(orderOf(today)) !== JSON.stringify(orderOf(program))
}

// ── Done ──

/** Done for the plan sheet and End: a logged set, a skip, or a check (as Resume reads it). */
export function isDeckItemDone(deckItem: DeckItem, session: Session | undefined): boolean {
  const entry = findEntry(session, deckItem.item.id)
  if (entry?.skipped) return true
  if (deckItem.logged) return (entry?.sets ?? []).some(isSetConfirmed)
  return entry?.checked === true
}

/**
 * D-074 rule 3: the rest timer after Done. Done that saved at least one set
 * not saved before starts rest now with the finished exercise's rest; Done
 * that saved nothing new leaves the timer as it was.
 */
export function restAfterDone(restUntil: number | null, newSets: number, restSec: number | undefined, now: number): number | null {
  if (newSets === 0 || !restSec || restSec <= 0) return restUntil
  return now + restSec * 1000
}

/**
 * D-074 rule 1: a logged item with some of its sets saved, not all, and not
 * skipped shows as in progress in the plan sheet (it still counts as done for
 * locking and Resume, D-065 rule 4).
 */
export function isDeckItemInProgress(deckItem: DeckItem, session: Session | undefined): boolean {
  const entry = findEntry(session, deckItem.item.id)
  if (!deckItem.logged || entry?.skipped) return false
  const rows = setRowsWithAdded(deckItem.resolved, entry?.addedSets)
  const saved = rows.filter((row) => isSetConfirmed(findSet(entry, row))).length
  return saved > 0 && saved < rows.length
}

// ── b. Moves ──

/**
 * Move `itemId` so it sits at `toIndex` of the resulting list, in `toSectionId`.
 * Done items never move; any other item can go anywhere, including between
 * done items (D-065 rule 4).
 */
export function moveItem(order: OrderEntry[], itemId: string, toIndex: number, toSectionId: string, done: ReadonlySet<string>): OrderEntry[] {
  if (done.has(itemId)) return order
  const from = order.findIndex((o) => o.itemId === itemId)
  if (from < 0) return order
  const rest = order.filter((o) => o.itemId !== itemId)
  const at = Math.max(0, Math.min(rest.length, toIndex))
  return [...rest.slice(0, at), { itemId, sectionId: toSectionId }, ...rest.slice(at)]
}

/**
 * One step up or down, as the Move up and Move down buttons do. Within a
 * section the item trades places with its neighbour; at the edge of a section
 * it crosses the section header into the neighbouring section, keeping its
 * place in the list. Returns null when there is nowhere to go.
 */
export function stepTarget(order: OrderEntry[], itemId: string, direction: 'up' | 'down'): { toIndex: number; toSectionId: string } | null {
  const i = order.findIndex((o) => o.itemId === itemId)
  if (i < 0) return null
  const here = order[i]
  const neighbour = order[direction === 'up' ? i - 1 : i + 1]
  if (!neighbour) return null
  if (neighbour.sectionId !== here.sectionId) return { toIndex: i, toSectionId: neighbour.sectionId }
  return { toIndex: direction === 'up' ? i - 1 : i + 1, toSectionId: here.sectionId }
}

// ── c. The current item after a move ──

/**
 * D-074 rule 1 (amends D-065 rule 3): an item moved to the current position or
 * ahead of it becomes current; the item it replaced keeps its saved sets. A
 * move to a later position changes nothing, except when the current item
 * itself moves later: then the item that takes its old place becomes current.
 */
export function currentAfterMove(before: OrderEntry[], after: OrderEntry[], currentId: string, movedId: string): string {
  const was = before.findIndex((o) => o.itemId === currentId)
  const now = after.findIndex((o) => o.itemId === currentId)
  if (movedId !== currentId) {
    // Only a move from behind the current item to its place or ahead of it.
    const from = before.findIndex((o) => o.itemId === movedId)
    const to = after.findIndex((o) => o.itemId === movedId)
    return from > was && to >= 0 && to < now ? movedId : currentId
  }
  if (now <= was) return currentId
  return after[was]?.itemId ?? currentId
}

// ── d. Added sets ──

/** setRowsFor plus `addedSets` more set numbers; L and R rows on per-side items (D-065 rule 5). */
export function setRowsWithAdded(resolved: Parameters<typeof setRowsFor>[0], addedSets: number | undefined): SetRow[] {
  const rows = setRowsFor(resolved)
  const base = Math.max(1, resolved.sets ?? 1)
  for (let k = 1; k <= (addedSets ?? 0); k++) {
    const n = base + k
    if (resolved.perSide) rows.push({ n, side: 'L' }, { n, side: 'R' })
    else rows.push({ n })
  }
  return rows
}

/** Distinct set numbers with a saved value today: what "Keep N sets" keeps. */
export function setsLoggedToday(entry: Entry | undefined): number {
  return new Set((entry?.sets ?? []).filter(isSetConfirmed).map((s) => s.n)).size
}

// ── Summary actions (D-055, D-065 rules 2 and 7) ──

function findBaseItem(program: Program, itemId: string): Item | undefined {
  for (const day of program.days) for (const section of day.sections) for (const item of section.items) if (item.id === itemId) return item
  return undefined
}

/** Weeks whose own override sets `sets` for this item; they keep it (D-042 rule 5). */
export function setsOverrideWeeks(program: Program, itemId: string): number[] {
  const item = findBaseItem(program, itemId)
  return Object.entries(item?.byWeek ?? {})
    .filter(([, override]) => override.sets !== undefined)
    .map(([week]) => Number(week))
    .sort((a, b) => a - b)
}

/** "Keep N sets in program": the base item's `sets` becomes `sets`; byWeek is untouched. */
export function keepSets(program: Program, itemId: string, sets: number): Program {
  const draft = loadDraft(program)
  const item = findBaseItem(draft, itemId)
  if (item) item.sets = sets
  return finishDraft(draft, program)
}

/**
 * "Keep this order": today's order and section moves written into that day.
 * Items not in today's order (retired ones) stay in their section, after the
 * ordered ones. A moved item whose new section kind would change how it is
 * logged gets `logged` set to how it was logged today (D-065 rule 2).
 */
export function keepOrder(program: Program, dayId: string, order: OrderEntry[], loggedToday: ReadonlyMap<string, boolean>): Program {
  const draft = loadDraft(program)
  const day = draft.days.find((d) => d.id === dayId)
  if (!day) return finishDraft(draft, program)
  const items = new Map<string, Item>()
  const home = new Map<string, string>()
  for (const section of day.sections) for (const item of section.items) {
    items.set(item.id, item)
    home.set(item.id, section.id)
  }
  const ordered = order.filter((o) => items.has(o.itemId) && day.sections.some((s) => s.id === o.sectionId))
  const placed = new Set(ordered.map((o) => o.itemId))
  day.sections = day.sections.map((section) => {
    const mine = ordered
      .filter((o) => o.sectionId === section.id)
      .map((o) => {
        const item = items.get(o.itemId)!
        const logged = loggedToday.get(o.itemId)
        if (home.get(o.itemId) !== section.id && logged !== undefined && isLogged(section.kind, item) !== logged) {
          return { ...item, logged }
        }
        return item
      })
    const kept = section.items.filter((item) => !placed.has(item.id))
    return { ...section, items: [...mine, ...kept] }
  })
  return finishDraft(draft, program)
}

// ── The plan sheet's sections (D-069 rule 11) ──

export interface PlanGroup {
  sectionId: string
  title: string
  items: { deckItem: DeckItem; index: number }[]
}

/**
 * Runs of consecutive items in one section, in today's order, plus every
 * section of the day that has no item today, as an empty group at its program
 * position: a drop target that never disappears (D-069 rule 11).
 */
export function planGroups(deck: DeckItem[], sections: readonly { id: string; title: string }[]): PlanGroup[] {
  const groups: PlanGroup[] = []
  deck.forEach((deckItem, index) => {
    const last = groups[groups.length - 1]
    if (last && last.sectionId === deckItem.section.id) last.items.push({ deckItem, index })
    else groups.push({ sectionId: deckItem.section.id, title: deckItem.section.title, items: [{ deckItem, index }] })
  })
  const rank = new Map(sections.map((s, i) => [s.id, i]))
  sections.forEach((section, i) => {
    if (groups.some((g) => g.sectionId === section.id)) return
    const at = groups.findIndex((g) => (rank.get(g.sectionId) ?? Infinity) > i)
    const empty: PlanGroup = { sectionId: section.id, title: section.title, items: [] }
    if (at < 0) groups.push(empty)
    else groups.splice(at, 0, empty)
  })
  return groups
}

/**
 * Move up or down as the plan sheet shows it: within a group the item trades
 * places; at a group's edge it crosses into the neighbouring group, empty ones
 * included, keeping its place in today's order. Null when there is nowhere to go.
 */
export function stepInGroups(groups: PlanGroup[], itemId: string, direction: 'up' | 'down'): { toIndex: number; toSectionId: string } | null {
  const g = groups.findIndex((group) => group.items.some((i) => i.deckItem.item.id === itemId))
  if (g < 0) return null
  const items = groups[g].items
  const k = items.findIndex((i) => i.deckItem.item.id === itemId)
  const flat = items[k].index
  if (direction === 'up') {
    if (k > 0) return { toIndex: flat - 1, toSectionId: groups[g].sectionId }
    return g > 0 ? { toIndex: flat, toSectionId: groups[g - 1].sectionId } : null
  }
  if (k < items.length - 1) return { toIndex: flat + 1, toSectionId: groups[g].sectionId }
  return g < groups.length - 1 ? { toIndex: flat, toSectionId: groups[g + 1].sectionId } : null
}
