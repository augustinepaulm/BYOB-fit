// The deck, frames 3b to 3g in the 1b layout (EXEC-10A task 6): per-set rows
// with last week's values, the progression chip (D-047), felt off (D-048),
// the demo slot (D-033), and a session-only swap. Set rows use separate
// Weight and Reps boxes (D-051, EXEC-11.1); the dictation hint is gone.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ExercisePicker } from '../builder/ExercisePicker.tsx'
import { Sheet } from '../builder/ui.tsx'
import { useLibrary, useStarterTemplates } from '../builder/useLibrary.ts'
import { getMeta, getProgram, listAllSessions, saveProgram, setMeta } from '../db/index.ts'
import { clearDraft, readDraft, type BuilderDraft } from '../builder/draft.ts'
import { blurSetBox, endDialogBody, endStep, type DoneItem } from '../lib/endFlow.ts'
import {
  addableItems,
  addedDeckItems,
  addedEntry,
  effectiveDeckItem,
  insertAfter,
  keepAddedInProgram,
  newAddedItemId,
  progressionHistory,
  swapPrefill,
} from '../lib/sessionExercises.ts'
import { howToSteps, lowerFirst } from '../lib/builder.ts'
import { formatTrainContext, toISODate } from '../lib/dates.ts'
import { canChangeDate } from '../lib/dayChanges.ts'
import { parseSet, type ParsedFields } from '../lib/parseSet.ts'
import { loadRowOutcome, numberBoxAttributes, repRangeText, singleRowOutcome, type BoxResult, type RowAction } from '../lib/setBoxes.ts'
import { entryLine, formatClock, formatRest, formatSetValue, prescriptionSentence, prescriptionText } from '../lib/prescription.ts'
import { dayForDate } from '../lib/program.ts'
import { suggestProgression, suggestionText } from '../lib/progression.ts'
import { compareWithLastWeek, readyToProgress } from '../lib/summary.ts'
import {
  buildDeck,
  findEntry,
  sessionIdFor,
  findReferenceEntry,
  findSet,
  isSetConfirmed,
  isSetFlagged,
  nearestWeightAbove,
  exactReferenceSet,
  referenceSet,
  summarise,
  type DeckItem,
  type SetRow,
} from '../lib/session.ts'
import {
  applyOrder,
  currentAfterMove,
  discardDraftConfirmation,
  restAfterDone,
  isDeckItemDone,
  isDeckItemInProgress,
  keepOfferLines,
  keepOrder,
  keepSets,
  moveItem,
  orderDiffers,
  orderOf,
  setRowsWithAdded,
  setsLoggedToday,
  setsOverrideWeeks,
} from '../lib/todayPlan.ts'
import { ChoiceRow, TickIcon } from '../onboarding/ui.tsx'
import { AddExercise } from './AddExercise.tsx'
import { ChangeDay } from './ChangeDay.tsx'
import { SwapStep } from './SwapStep.tsx'
import { PlanSheet } from './PlanSheet.tsx'
import { useProgram } from '../program/useProgram.ts'
import { clearDeckState, readDeckState, writeDeckState } from '../session/deckState.ts'
import { useSession } from '../session/useSession.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Exercise, ItemFields } from '../types/program.ts'
import type { Entry, FeltOff, Session, SetLog } from '../types/stores.ts'
import { ChevronLeftIcon } from '../ui/icons.tsx'
import { Dialog } from '../ui/Dialog.tsx'
import { StateBlock } from '../ui/StateBlock.tsx'
import { AppHeader, ProgressRing, Tick } from '../ui/shell.tsx'

const DEMO_SEEN = 'demoSeen'

const FELT: { value: FeltOff; title: string; sub?: string }[] = [
  { value: 'easy', title: 'Too easy' },
  { value: 'hard', title: 'Too hard' },
  { value: 'discomfort', title: 'Discomfort', sub: 'Skips the rest of this exercise today' },
]
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const FELT_WORD: Record<FeltOff, string> = { easy: 'too easy', hard: 'too hard', discomfort: 'discomfort' }

function rowKey(itemId: string, row: SetRow): string {
  return `${itemId}:${row.n}:${row.side ?? ''}`
}

/**
 * Placeholder text when there is no last-week value: the prescription, shown
 * only. D-053: it is never saved (the reps range, e.g. "8–12").
 */
function prescriptionPlaceholder(resolved: ItemFields): string {
  switch (resolved.type) {
    case 'timed_hold':
      return String(resolved.holdSec ?? '')
    case 'distance':
      return String(resolved.distanceM ?? '')
    case 'cardio_block':
      return String(resolved.minutes ?? '')
    default:
      return repRangeText(resolved.repMin, resolved.repMax)
  }
}

type Box = 'w' | 'r' | 'v'
const boxKey = (key: string, box: Box) => `${key}|${box}`

/** The one box of a non-load item: what it reads, where it stores it, its unit. */
const SINGLE: Record<string, { kind: 'reps' | 'seconds' | 'meters' | 'minutes'; field: 'reps' | 'seconds' | 'distanceM' | 'minutes'; unit: string; decimal: boolean }> = {
  bodyweight_reps: { kind: 'reps', field: 'reps', unit: 'reps', decimal: false },
  timed_hold: { kind: 'seconds', field: 'seconds', unit: 's', decimal: false },
  distance: { kind: 'meters', field: 'distanceM', unit: 'm', decimal: true },
  cardio_block: { kind: 'minutes', field: 'minutes', unit: 'min', decimal: false },
}


/**
 * D-054 rule 2: after a box takes focus, wait for the keyboard (the visual
 * viewport's next resize) or 350 ms, whichever is first, then put the set's
 * row in the upper part of the visible area (above the midline, 4.09).
 */
function afterKeyboard(): Promise<void> {
  const viewport = window.visualViewport
  if (!viewport) return Promise.resolve()
  return new Promise((resolve) => {
    let timer = 0
    const finish = () => {
      window.clearTimeout(timer)
      viewport.removeEventListener('resize', finish)
      resolve()
    }
    viewport.addEventListener('resize', finish)
    timer = window.setTimeout(finish, 350)
  })
}

async function centreInVisibleArea(row: HTMLElement) {
  await afterKeyboard()
  if (!row.isConnected) return
  const viewport = window.visualViewport
  const rect = row.getBoundingClientRect()
  // 4.09: the active set sits above the visible area's midline, so the keyboard never covers it.
  const target = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) * ROW_TARGET
  window.scrollBy({ top: rect.top + rect.height / 2 - target, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}

/** Where the focused set's centre lands in the visible area, from its top: above the midline (frame 4.09). */
export const ROW_TARGET = 0.38

/** D-054 rule 4: the focused box's name, pinned to the top of the visible area. */
function FocusLabel({ text }: { text: string }) {
  const [top, setTop] = useState(() => window.visualViewport?.offsetTop ?? 0)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setTop(viewport.offsetTop)
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])
  return (
    <div className="dk-focus-label" style={{ top }} aria-hidden="true">
      {text}
    </div>
  )
}

/** D-033: the bundled demo file, or the placeholder frame. */
function DemoMedia({ exercise }: { exercise: Exercise | undefined }) {
  const src = exercise?.demo ? `${import.meta.env.BASE_URL}${exercise.demo}` : null
  if (src && /\.(mp4|webm)$/.test(src)) return <video src={src} autoPlay loop muted playsInline />
  if (src) return <img src={src} alt="" />
  return <span className="dk-demo__label">demo · looping clip</span>
}

/**
 * D-069 rule 5: the deck is keyed by today's day, so changing today's workout
 * mid-session starts the new day's deck from its first item.
 */
export function DeckScreen() {
  const { program, today, changes } = useProgram()
  const dayId = program ? dayForDate(program, changes, today).id : 'none'
  return <Deck key={dayId} />
}

function Deck() {
  const { program, today, week, changes, refresh, setChange } = useProgram()
  const { settings } = useSettings()
  const navigate = useNavigate()
  // Today's Resume button already asked; a reopened deck asks here (7b).
  const routeState = useLocation().state as { fromToday?: boolean; summary?: boolean } | null
  const fromToday = routeState?.fromToday === true
  // Today's "See summary" (2.03) opens a finished session's summary directly.
  const summaryFirst = routeState?.summary === true
  const { templates } = useStarterTemplates()
  const library = useLibrary(program, templates)

  const day = program ? dayForDate(program, changes, today) : null
  const scheduled = program?.days.find((d) => d.order === today.getDay())
  const swapped = Boolean(scheduled && day && scheduled.id !== day.id)
  const todayIso = toISODate(today)
  const isNew = settings.onboarding?.experience === 'new'

  const target = useMemo(
    () => (day ? { date: todayIso, dayId: day.id, programWeek: week, swapped } : null),
    [day, todayIso, week, swapped],
  )
  const api = useSession(target)
  const sessionId = day ? sessionIdFor(todayIso, day.id) : null
  // The program's deck, and today's: the session's order applied (D-063, D-065 rule 1).
  const baseDeck = useMemo(() => (day ? buildDeck(day, week, today) : []), [day, week, today])
  const sessionOrder = api.session?.order
  // D-069 rules 7 to 9: exercises added today join today's order, and an entry
  // logged with its own prescription replaces the program's.
  const deck = useMemo(() => {
    if (!day || !program) return baseDeck
    const ordered = applyOrder([...baseDeck, ...addedDeckItems(api.session, program, day)], day, sessionOrder)
    return ordered.map((d) => effectiveDeckItem(d, findEntry(api.session ?? undefined, d.item.id)))
  }, [baseDeck, day, program, sessionOrder, api.session])

  // Where the user has navigated to with Done or Back. Null until they move.
  const [position, setPosition] = useState<number | null>(null)
  // Where Resume dropped them, decided once when the stored session arrives.
  const [startAt, setStartAt] = useState<number | null>(null)
  const [phase, setPhase] = useState<'deck' | 'summary'>(summaryFirst ? 'summary' : 'deck')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [holdStart, setHoldStart] = useState<Record<string, number>>({})
  const [cardioStart, setCardioStart] = useState<number | null>(null)
  const [demoOpen, setDemoOpen] = useState<Record<number, boolean>>({})
  const [history, setHistory] = useState<Session[]>([])
  const [now, setNow] = useState(Date.now)
  const [sheet, setSheet] = useState<'felt' | 'swap' | null>(null)
  const [feltChoice, setFeltChoice] = useState<FeltOff | null>(null)
  const [seenAtLoad, setSeenAtLoad] = useState<string[] | null>(null)
  // D-051: an invalid box shows its message under it; keyed by boxKey.
  const [errors, setErrors] = useState<Record<string, string>>({})
  // 7b states: the resume prompt, a set that did not save, and End early.
  const [resumeAsked, setResumeAsked] = useState(fromToday)
  const [saveFailed, setSaveFailed] = useState<{ row: SetRow } | null>(null)
  const [endAsked, setEndAsked] = useState(false)
  // D-054 rules 3 and 4: the focused set box's name; null when none has focus.
  const [focusLabel, setFocusLabel] = useState<string | null>(null)
  // D-063: the plan sheet; D-065 rule 8: summary Keep controls and the draft check.
  const [planOpen, setPlanOpen] = useState(false)
  // D-069 rule 5: Change today's workout from the Plan sheet.
  const [changingDay, setChangingDay] = useState(false)
  // D-069 rules 7 and 8: the Add exercise list, and the swap step after a pick.
  const [adding, setAdding] = useState(false)
  const [swapPick, setSwapPick] = useState<{ id: string; name: string } | null>(null)
  const [kept, setKept] = useState<{ sets: Record<string, boolean>; order: boolean }>({ sets: {}, order: false })
  const [keepError, setKeepError] = useState<string | null>(null)
  const [draftWaiting, setDraftWaiting] = useState<BuilderDraft | false | null>(null)
  const [discardAsked, setDiscardAsked] = useState(false)
  const seen = useRef<string[]>([])
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // D-077 rule 4: the rest timer, typed boxes and position kept from the last visit.
  const [restored, setRestored] = useState(false)
  const [restSec, setRestSec] = useState<number | null>(null)
  // The set opened for typing or editing; null follows the first set still waiting (2.04).
  const [editingN, setEditingN] = useState<number | null>(null)

  useEffect(() => {
    if (!sessionId) return
    let live = true
    void readDeckState(sessionId).then((kept) => {
      if (!live) return
      if (kept) {
        setDrafts(kept.drafts)
        if (kept.restUntil && kept.restUntil > Date.now()) {
          setRestUntil(kept.restUntil)
          setRestSec(kept.restSec ?? null)
        }
        if (kept.position !== null) setPosition(kept.position)
      }
      setRestored(true)
    })
    return () => {
      live = false
    }
  }, [sessionId])

  // D-064 rule 2: the banner flag never outlives the deck.
  useEffect(() => () => void delete document.documentElement.dataset.setFocus, [])

  // One ticker drives the rest, hold and cardio timers; all read Date.now().
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let live = true
    void Promise.all([listAllSessions(), getMeta(DEMO_SEEN)]).then(([found, demo]) => {
      if (!live) return
      setHistory(found)
      let list: string[]
      try {
        list = demo ? (JSON.parse(demo) as string[]) : []
      } catch {
        list = []
      }
      seen.current = list
      setSeenAtLoad(list)
    })
    return () => {
      live = false
    }
  }, [])

  // Resume reopens at the first item with nothing recorded against it.
  const firstIncomplete = deck.findIndex((deckItem) => !isDeckItemDone(deckItem, api.session ?? undefined))
  if (!api.loading && startAt === null && deck.length > 0) {
    setStartAt(firstIncomplete === -1 ? Math.max(0, deck.length - 1) : firstIncomplete)
  }
  // A kept position can outlast an item removed since; stay inside the deck.
  const at = Math.min(position ?? startAt ?? 0, Math.max(0, deck.length - 1))
  const current: DeckItem | undefined = deck[at]
  const entry = findEntry(api.session ?? undefined, current?.item.id ?? '')
  const exerciseId = entry?.exerciseId ?? current?.resolved.exerciseId ?? ''
  const exercise: Exercise | undefined = program?.exercises[exerciseId] ?? library.find((l) => l.id === exerciseId)?.exercise
  const referenceEntry = useMemo(
    () => (day ? findReferenceEntry(history, day.id, exerciseId, current?.resolved.type) : undefined),
    [history, day, exerciseId, current?.resolved.type],
  )
  const unit = current?.resolved.unit ?? 'kg'

  // D-077 rules 3 and 4: keep what leaving would lose, and what the in-progress bar shows.
  const open = Boolean(api.session && !api.session.endedAt)
  const barLabel = useMemo(() => {
    if (!exercise?.name) return undefined
    const next = current?.logged
      ? setRowsWithAdded(current.resolved, entry?.addedSets).find((row) => !isSetConfirmed(findSet(entry, row)))
      : undefined
    return next ? `${exercise.name}, set ${next.n} next` : exercise.name
  }, [current, entry, exercise])
  useEffect(() => {
    if (!restored || !sessionId || !open || phase !== 'deck') return
    void writeDeckState({
      sessionId,
      restUntil,
      ...(restSec ? { restSec } : {}),
      drafts,
      position,
      ...(barLabel ? { label: barLabel } : {}),
    })
  }, [restored, sessionId, open, phase, restUntil, restSec, drafts, position, barLabel])
  // The summary means the session ended or was discarded: nothing to keep.
  useEffect(() => {
    if (phase === 'summary' && sessionId) void clearDeckState(sessionId)
  }, [phase, sessionId])

  // D-033: a New user sees each exercise's demo open the first time it appears.
  const firstView = isNew && seenAtLoad !== null && Boolean(exerciseId) && !seenAtLoad.includes(exerciseId)
  const demoExpanded = demoOpen[at] ?? firstView
  useEffect(() => {
    if (!firstView || seen.current.includes(exerciseId)) return
    seen.current = [...seen.current, exerciseId]
    void setMeta(DEMO_SEEN, JSON.stringify(seen.current))
  }, [firstView, exerciseId])

  // D-047: this item's recent entries with this exercise, newest first. D-069
  // rule 9: entries logged with their own prescription do not count, and
  // today's added or changed exercise gets no suggestion for the program item.
  const suggestion = useMemo(() => {
    if (!current || entry?.changed || entry?.added) return null
    const past: Entry[] = progressionHistory(history, current.item.id, exerciseId, todayIso)
    return suggestProgression({ ...current.resolved, progression: current.item.progression }, exercise, past, unit)
  }, [current, entry, history, todayIso, exerciseId, exercise, unit])

  const prefillFor = useCallback(
    (row: SetRow): { firstTime: boolean; reference?: SetLog } => {
      const reference = referenceSet(referenceEntry, row)
      return reference ? { firstTime: false, reference } : { firstTime: true }
    },
    [referenceEntry],
  )

  /** D-053: last week's set for this exact row, the only source an untouched row saves from. */
  const exactReference = useCallback((row: SetRow): SetLog | undefined => exactReferenceSet(referenceEntry, row), [referenceEntry])

  const startRest = useCallback(() => {
    const restSec = current?.resolved.restSec
    if (restSec && restSec > 0) {
      setRestUntil(Date.now() + restSec * 1000)
      setRestSec(restSec)
    }
  }, [current])

  /** Weight placeholder: last week's for this set, else the nearest set above saved today. */
  const weightHint = useCallback(
    (row: SetRow): number | undefined => exactReference(row)?.weight ?? nearestWeightAbove(entry, row),
    [exactReference, entry],
  )

  const clearBoxes = useCallback((key: string) => {
    const drop = (d: Record<string, string>) => {
      const next = { ...d }
      for (const box of ['w', 'r', 'v'] as Box[]) delete next[boxKey(key, box)]
      return next
    }
    setDrafts(drop)
    setErrors(drop)
  }, [])

  // Sets Done saved that were not saved before (D-074 rule 3).
  const savedByDone = useRef(0)

  const writeRow = useCallback(
    async (row: SetRow, fields: ParsedFields, action: RowAction = 'tick') => {
      if (!current) return true
      try {
        await api.writeSet(current.item.id, exerciseId, { n: row.n, ...(row.side ? { side: row.side } : {}), ...fields })
      } catch {
        // 7b: what was typed stays in its boxes; nothing else is lost.
        setSaveFailed({ row })
        return false
      }
      setSaveFailed(null)
      clearBoxes(rowKey(current.item.id, row))
      setEditingN(null)
      // Done starts rest once, after all its saves (D-074 rule 3).
      if (action === 'done') savedByDone.current += 1
      else startRest()
      return true
    },
    [api, current, exerciseId, clearBoxes, startRest],
  )

  /**
   * D-051, D-053: save one set from its boxes. An untouched row saves only
   * last week's values for that row; the tick asks for what is missing and
   * Done leaves it empty. An invalid box shows its error and nothing is saved.
   * No raw rows are written here.
   */
  const saveRow = useCallback(
    async (row: SetRow, action: RowAction = 'tick'): Promise<boolean> => {
      if (!current) return true
      const key = rowKey(current.item.id, row)
      const type = current.resolved.type ?? 'load_reps'
      const stored = findSet(entry, row)
      const confirmed = isSetConfirmed(stored)
      const flaggedRaw = isSetFlagged(stored) ? (stored?.raw ?? '') : undefined
      const { reference } = prefillFor(row)
      const exact = exactReference(row)
      const typed = (box: Box) => drafts[boxKey(key, box)]

      // "same" in any box copies last week's set, as before.
      if ((['w', 'r', 'v'] as Box[]).some((box) => /^\s*same(\s+again)?\s*$/i.test(typed(box) ?? ''))) {
        const result = parseSet('same', { type, reference })
        if (!result.ok) {
          setErrors((e) => ({ ...e, [boxKey(key, type === 'load_reps' ? 'w' : 'v')]: 'Nothing from last week to copy' }))
          return false
        }
        return writeRow(row, result.fields, action)
      }

      const show = (results: [Box, BoxResult][]) => {
        setErrors((e) => {
          const next = { ...e }
          for (const [box, result] of results) {
            if (result.ok) delete next[boxKey(key, box)]
            else next[boxKey(key, box)] = result.error
          }
          return next
        })
        return results.every(([, result]) => result.ok)
      }

      if (type === 'load_reps') {
        const wText = typed('w') ?? (confirmed ? String(stored?.weight ?? '') : (flaggedRaw ?? ''))
        const rText = typed('r') ?? (confirmed ? String(stored?.reps ?? '') : '')
        const outcome = loadRowOutcome(
          { weightText: wText, repsText: rText, reference: exact, weightAbove: nearestWeightAbove(entry, row) },
          action,
        )
        if (outcome.kind === 'skip') return true
        if (outcome.kind === 'invalid') {
          show([['w', outcome.weight], ['r', outcome.reps]])
          return false
        }
        show([['w', { ok: true, value: outcome.weight }], ['r', { ok: true, value: outcome.reps }]])
        return writeRow(row, { weight: outcome.weight, reps: outcome.reps }, action)
      }

      const single = SINGLE[type] ?? SINGLE.bodyweight_reps
      const vText = typed('v') ?? (confirmed ? String(stored?.[single.field] ?? '') : (flaggedRaw ?? ''))
      const outcome = singleRowOutcome(vText, single.kind, exact?.[single.field], action)
      if (outcome.kind === 'skip') return true
      if (outcome.kind === 'invalid') {
        show([['v', outcome.value]])
        return false
      }
      show([['v', { ok: true, value: outcome.value }]])
      return writeRow(row, { [single.field]: outcome.value }, action)
    },
    [current, entry, drafts, prefillFor, exactReference, writeRow],
  )

  const advance = useCallback(
    (from: number) => {
      if (from >= deck.length - 1) {
        // D-075 rule 3: every way into the summary ends the session now.
        void api.end()
        setPhase('summary')
        window.scrollTo({ top: 0 })
        return
      }
      setPosition(from + 1)
      setEditingN(null)
      window.scrollTo({ top: 0 })
    },
    [deck.length, api],
  )

  /** Done: save typed rows and last week's values for untouched ones, then advance. */
  const done = useCallback(async () => {
    if (!current) return
    const from = deck.indexOf(current)
    if (!current.logged || current.resolved.type === 'check') {
      await api.setChecked(current.item.id, exerciseId, true)
      advance(from)
      return
    }
    if (entry?.skipped) {
      advance(from)
      return
    }
    savedByDone.current = 0
    for (const row of setRowsWithAdded(current.resolved, entry?.addedSets)) {
      const key = rowKey(current.item.id, row)
      const hasTyped = (['w', 'r', 'v'] as Box[]).some((box) => (drafts[boxKey(key, box)] ?? '').trim() !== '')
      const stored = findSet(entry, row)
      // Typed boxes must save; an untouched row saves only last week's values
      // for that row, and is otherwise left empty (D-053).
      const saved = stored && !hasTyped ? true : await saveRow(row, 'done')
      if (!saved) {
        setRestUntil((until) => restAfterDone(until, savedByDone.current, current.resolved.restSec, Date.now()))
        setRestSec(current.resolved.restSec ?? null)
        return
      }
    }
    setRestUntil((until) => restAfterDone(until, savedByDone.current, current.resolved.restSec, Date.now()))
    setRestSec(current.resolved.restSec ?? null)
    advance(from)
  }, [api, current, deck, exerciseId, drafts, entry, saveRow, advance])

  // D-065 rule 8: Keep controls wait for any builder draft to be finished or discarded.
  useEffect(() => {
    if (phase !== 'summary') return
    let live = true
    void readDraft().then((draft) => live && setDraftWaiting(draft ?? false))
    return () => {
      live = false
    }
  }, [phase])

  const finish = useCallback(async () => {
    await api.finish()
    navigate('/', { replace: true })
  }, [api, navigate])

  // Wait for the stored session before choosing where to resume.
  if (!program || !day || api.loading || !restored) return null
  if (!day.rest && startAt === null) return null

  if (day.rest) {
    return (
      <div className="tl">
        <div className="tl-head">
          <h1 className="tl-head__title">Rest day</h1>
          <div className="tl-head__sub">Nothing to run today.</div>
        </div>
      </div>
    )
  }

  const summary = summarise(api.session ?? undefined, deck)
  const setsLogged = summary.setsConfirmed
  // Exercises with nothing recorded yet, for End early (7b).
  const doneIds = new Set(deck.filter((deckItem) => isDeckItemDone(deckItem, api.session ?? undefined)).map((d) => d.item.id))
  const inProgressIds = new Set(deck.filter((deckItem) => isDeckItemInProgress(deckItem, api.session ?? undefined)).map((d) => d.item.id))
  const notDone = deck.length - doneIds.size
  const restRemaining = restUntil ? (restUntil - now) / 1000 : 0
  const nameOf = (id: string) => program.exercises[id]?.name ?? library.find((l) => l.id === id)?.exercise.name ?? id
  // Frame 2.11: what the End dialog says has been done.
  const doneForEnd: DoneItem[] = deck
    .filter((d) => doneIds.has(d.item.id))
    .map((d) => {
      const e = findEntry(api.session ?? undefined, d.item.id)
      const name = lowerFirst(nameOf(e?.exerciseId ?? d.resolved.exerciseId ?? ''))
      if (d.section.kind === 'warmup') return { name, warmup: true }
      return d.logged && d.resolved.type !== 'check' ? { name, sets: (e?.sets ?? []).filter(isSetConfirmed).length } : { name }
    })

  /**
   * End, from the header or the plan sheet (D-067 rule 2): close the keyboard
   * first, then confirm in a dialog over the screen when items are not done.
   */
  const endFlow = () => {
    blurSetBox(document)
    if (endStep(notDone) === 'confirm') {
      setEndAsked(true)
      return
    }
    window.scrollTo({ top: 0 })
    void api.end()
    setPhase('summary')
  }

  /** D-063 rule 4, D-065 rules 1 and 3: move an item, store today's order, keep the right item current. */
  const moveInPlan = async (itemId: string, toIndex: number, toSectionId: string) => {
    const before = orderOf(deck)
    const after = moveItem(before, itemId, toIndex, toSectionId, doneIds)
    if (JSON.stringify(after) === JSON.stringify(before)) return
    const currentId = deck[at]?.item.id
    await api.setOrder(after)
    if (currentId) setPosition(after.findIndex((o) => o.itemId === currentAfterMove(before, after, currentId, itemId)))
  }

  /** D-074 rule 4: compared with last week, and ready to progress. */
  function renderProgress() {
    if (!day) return null
    const session = api.session ?? undefined
    const compared = compareWithLastWeek(session, deck, history, day.id)
    const ready = readyToProgress(session, deck, history, (id) => program?.exercises[id] ?? library.find((l) => l.id === id)?.exercise)
    const counted = compared.up + compared.same + compared.down
    return (
      <>
        {(counted > 0 || compared.newIds.length > 0) && (
          <section className="card-v3 compare">
            <h2 className="compare__title">Compared with last week</h2>
            {counted > 0 && (
              <div className="compare__tiles">
                <div className="compare__tile compare__tile--up">
                  <b>{compared.up}</b>
                  <span>Up</span>
                </div>
                <div className="compare__tile">
                  <b>{compared.same}</b>
                  <span>Same</span>
                </div>
                <div className="compare__tile">
                  <b>{compared.down}</b>
                  <span>Down</span>
                </div>
              </div>
            )}
            {compared.upLines.map((line) => (
              <div className="compare__line" key={line.exerciseId}>
                <span className="compare__name">{nameOf(line.exerciseId)}</span>
                <span className="compare__values">
                  <b>{line.today}</b>
                  <span>was {line.last}</span>
                </span>
              </div>
            ))}
            {compared.newIds.length > 0 && (
              <div className="compare__line">
                <span className="compare__name">New</span>
                <span className="compare__values">
                  <span>{compared.newIds.map((id) => nameOf(id)).join(', ')}</span>
                </span>
              </div>
            )}
          </section>
        )}
        {ready.length > 0 && (
          // D-083 rule 2: the suggestion as text; it never applies itself (D-047).
          <section className="card-v3 compare">
            <h2 className="compare__title">Ready to progress</h2>
            {ready.map((r) => (
              <p className="compare__text" key={r.exerciseId}>
                {nameOf(r.exerciseId)}: {r.text}
              </p>
            ))}
          </section>
        )}
      </>
    )
  }

  /** D-063 rule 6, D-055, D-065 rules 2, 7 and 8: only these taps change the program. */
  function renderKeep() {
    if (!program || !day) return null
    const session = api.session ?? undefined
    const added = deck
      .map((deckItem) => {
        const recorded = findEntry(session, deckItem.item.id)
        const n = setsLoggedToday(recorded)
        return { deckItem, n, weeks: setsOverrideWeeks(program, deckItem.item.id) }
      })
      .filter(({ deckItem, n }) => {
        const recorded = findEntry(session, deckItem.item.id)
        return !recorded?.added && (kept.sets[deckItem.item.id] || ((recorded?.addedSets ?? 0) > 0 && n > (deckItem.item.sets ?? 1)))
      })
    // D-069 rule 7: an exercise added today can be kept in today's day.
    const addedToday = (session?.entries ?? []).filter((e) => e.added)
    const programDeck = deck.filter((d) => !findEntry(session, d.item.id)?.added)
    const orderOffered = kept.order || (Boolean(session?.order) && orderDiffers(programDeck, baseDeck))
    if (added.length === 0 && !orderOffered && addedToday.length === 0) return null

    const keepAddedExercise = async (e: Entry) => {
      setKeepError(null)
      try {
        const latest = (await getProgram(program.id)) ?? program
        await saveProgram(keepAddedInProgram(latest, day.id, orderOf(deck), e))
        await refresh()
        setKept((k) => ({ ...k, sets: { ...k.sets, [`added:${e.itemId}`]: true } }))
      } catch (error) {
        setKeepError(`Could not keep it: ${(error as Error).message}`)
      }
    }

    const keepAdded = async (itemId: string, n: number) => {
      setKeepError(null)
      try {
        const latest = (await getProgram(program.id)) ?? program
        await saveProgram(keepSets(latest, itemId, n))
        await refresh()
        setKept((k) => ({ ...k, sets: { ...k.sets, [itemId]: true } }))
      } catch (e) {
        setKeepError(`Could not keep it: ${(e as Error).message}`)
      }
    }
    const keepTodaysOrder = async () => {
      setKeepError(null)
      try {
        const latest = (await getProgram(program.id)) ?? program
        const loggedToday = new Map(deck.map((d) => [d.item.id, d.logged]))
        await saveProgram(keepOrder(latest, day.id, orderOf(programDeck), loggedToday))
        await refresh()
        setKept((k) => ({ ...k, order: true }))
      } catch (e) {
        setKeepError(`Could not keep it: ${(e as Error).message}`)
      }
    }

    return (
      <section className="card-v3 dk-keep">
        <h2 className="compare__title">Change the program?</h2>
        {draftWaiting === null ? null : draftWaiting ? (
          // D-074 rule 7: say what waits on the draft, and let it be opened or discarded here.
          <>
            <p className="dk-keep__note">Finish or discard your program draft first to keep these changes. Once it is cleared, you can:</p>
            <ul className="dk-keep__pending">
              {keepOfferLines({
                sets: added.filter(({ deckItem }) => !kept.sets[deckItem.item.id]).map(({ deckItem, n }) => ({ name: nameOf(deckItem.resolved.exerciseId ?? ''), n })),
                exercises: addedToday.filter((e) => !kept.sets[`added:${e.itemId}`]).map((e) => nameOf(e.exerciseId)),
                order: orderOffered && !kept.order,
              }).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="ai-banner__actions">
              <button type="button" className="chip chip--on" onClick={() => navigate(draftWaiting.mode === 'edit' ? '/program/edit' : '/program/new')}>
                Open draft
              </button>
              <button type="button" className="chip" onClick={() => setDiscardAsked(true)}>
                Discard draft
              </button>
            </div>
            {discardAsked && (
              <Dialog
                {...discardDraftConfirmation(draftWaiting)}
                confirmLabel="Discard draft"
                danger
                onCancel={() => setDiscardAsked(false)}
                onConfirm={() => {
                  setDiscardAsked(false)
                  void clearDraft().then(() => setDraftWaiting(false))
                }}
              />
            )}
          </>
        ) : (
          <>
            {added.map(({ deckItem, n, weeks }) => (
              <div className="dk-keep__row" key={deckItem.item.id}>
                <div className="dk-keep__main">
                  <div className="dk-keep__title">{nameOf(deckItem.resolved.exerciseId ?? '')}</div>
                  <div className="dk-keep__sub">
                    {n} sets today, {deckItem.item.sets ?? 1} in the program
                    {weeks.length > 0 && ` · Week${weeks.length > 1 ? 's' : ''} ${weeks.join(', ')} ${weeks.length > 1 ? 'keep their' : 'keeps its'} own set count`}
                  </div>
                </div>
                {kept.sets[deckItem.item.id] ? (
                  <span className="dk-keep__kept">Kept</span>
                ) : (
                  <button type="button" className="chip" onClick={() => void keepAdded(deckItem.item.id, n)}>
                    Keep {n} sets in program
                  </button>
                )}
              </div>
            ))}
            {addedToday.map((e) => (
              <div className="dk-keep__row" key={`added:${e.itemId}`}>
                <div className="dk-keep__main">
                  <div className="dk-keep__title">{nameOf(e.exerciseId)}</div>
                  <div className="dk-keep__sub">Added today</div>
                </div>
                {kept.sets[`added:${e.itemId}`] ? (
                  <span className="dk-keep__kept">Kept</span>
                ) : (
                  <button type="button" className="chip" onClick={() => void keepAddedExercise(e)}>
                    Keep {nameOf(e.exerciseId)} in program
                  </button>
                )}
              </div>
            ))}
            {orderOffered && (
              <div className="dk-keep__row">
                <div className="dk-keep__main">
                  <div className="dk-keep__title">Today&apos;s order</div>
                  <div className="dk-keep__sub">You changed the order or sections today.</div>
                </div>
                {kept.order ? (
                  <span className="dk-keep__kept">Kept</span>
                ) : (
                  <button type="button" className="chip" onClick={() => void keepTodaysOrder()}>
                    Keep this order
                  </button>
                )}
              </div>
            )}
            {keepError && (
              <div className="ob-errors" role="alert">
                {keepError}
              </div>
            )}
          </>
        )}
      </section>
    )
  }

  // ── 3g Session summary ──
  // D-086 rule 2: an ended session with nothing in it was deleted; the day stays open.
  if (phase === 'summary' && (api.discarded || !api.session)) {
    return (
      <div className="screen screen--dock">
        <AppHeader context={formatTrainContext(today, week)} title={day.focus ?? day.name} aside="Summary" />
        <section className="card-v3 today-card">
          <div className="today-card__meta">
            {WEEKDAY.format(today)} · week {week}
          </div>
          <h1 className="today-card__title">Nothing was logged</h1>
          <p className="today-card__sub">The workout is still open for today.</p>
        </section>
        <div className="dock-v3">
          <button type="button" className="btn btn--primary tl-done" onClick={() => navigate('/', { replace: true })}>
            Done
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'summary') {
    const felt = (api.session?.entries ?? []).filter((e) => e.feltOff)
    const minutes =
      summary.durationMin ?? Math.max(0, Math.round((now - new Date(api.session?.startedAt ?? now).getTime()) / 60000))
    const totalSets = deck.filter((d) => d.logged && d.resolved.type !== 'check').reduce((n, d) => n + setRowsWithAdded(d.resolved, findEntry(api.session ?? undefined, d.item.id)?.addedSets).length, 0)
    return (
      <div className="screen screen--dock">
        <AppHeader context={formatTrainContext(today, week)} title={day.focus ?? day.name} aside="Summary" />
        <section className="card-v3 today-card">
          <div className="today-card__meta">
            {WEEKDAY.format(today)} · week {week} of {program.programWeeks}
          </div>
          <h1 className="today-card__title">{day.focus ?? day.name} done</h1>
          <p className="today-card__sub">
            {summary.setsConfirmed} of {totalSets} sets · {minutes} min{summary.skipped > 0 ? ` · ${summary.skipped} skipped` : ''}
          </p>
        </section>
        {swapped && <p className="note-v3">Logged as {day.name}&apos;s session (days changed)</p>}
        {renderProgress()}
        {felt.length > 0 && (
          <p className="note-v3">
            Felt off: {felt.map((e) => `${lowerFirst(nameOf(e.exerciseId))}, ${FELT_WORD[e.feltOff!]}`).join('; ')}.
          </p>
        )}
        {renderKeep()}
        <div className="dock-v3">
          <button type="button" className="btn btn--primary tl-done" onClick={() => void finish()}>
            Finish
          </button>
        </div>
      </div>
    )
  }

  if (!current) return null

  // ── Add exercise (D-069 rule 7) ──
  if (adding) {
    return (
      <AddExercise
        items={addableItems(program, week, today)}
        onBack={() => setAdding(false)}
        onPick={(source) =>
          void (async () => {
            const id = newAddedItemId(program, api.session)
            const order = insertAfter(orderOf(deck), current.item.id, id, current.section.id)
            await api.addEntry(addedEntry(source, id), order)
            setAdding(false)
            setPosition(order.findIndex((o) => o.itemId === id))
            window.scrollTo({ top: 0 })
          })()
        }
      />
    )
  }

  // ── Swap with its own prescription (D-069 rule 8) ──
  if (sheet === 'swap' && swapPick) {
    const prefill = swapPrefill(program, swapPick.id, current.item.id, week, today, current.resolved)
    return (
      <SwapStep
        exerciseName={swapPick.name}
        prefill={prefill.fields}
        from={prefill.from}
        onBack={() => setSwapPick(null)}
        onConfirm={(fields) =>
          void api.changeExercise(current.item.id, swapPick.id, fields).then(() => {
            setSwapPick(null)
            setSheet(null)
          })
        }
      />
    )
  }

  // ── Swap for this session only (frame 2c) ──
  if (sheet === 'swap') {
    return (
      <ExercisePicker
        title={`Swap ${lowerFirst(exercise?.name ?? exerciseId)}`}
        current={exercise ? { id: exerciseId, exercise } : undefined}
        library={library}
        beginnerDefault={isNew}
        draft={program}
        allowCreate={false}
        sameMusclesOff
        onBack={() => setSheet(null)}
        onPick={(picked) => setSwapPick({ id: picked.id, name: picked.exercise.name })}
      />
    )
  }

  const next = deck[at + 1]
  const alternateId = current.resolved.alternateExerciseId
  const onAlternate = alternateId !== undefined && exerciseId === alternateId
  const swapTo = onAlternate ? current.resolved.exerciseId : alternateId

  const isCheckTile = !current.logged || current.resolved.type === 'check'
  const isCardioTile = current.logged && current.resolved.type === 'cardio_block'
  const checked = entry?.checked === true
  const collapseDemo = () => setDemoOpen((d) => (d[at] === false ? d : { ...d, [at]: false }))
  const steps = howToSteps(exercise?.howTo ?? '')

  /** One box of a set row (D-051): its value or placeholder, its unit, and its error under it. */
  function renderBox(row: SetRow, box: Box) {
    if (!current) return null
    const key = rowKey(current.item.id, row)
    const id = `box-${key}-${box}`.replace(/[^a-zA-Z0-9_-]/g, '-')
    const single = SINGLE[current.resolved.type ?? 'load_reps'] ?? SINGLE.bodyweight_reps
    const stored = findSet(entry, row)
    const confirmed = isSetConfirmed(stored)
    const flagged = isSetFlagged(stored)
    const { firstTime } = prefillFor(row)
    const exact = exactReference(row)
    const draft = drafts[boxKey(key, box)]
    const error = errors[boxKey(key, box)]
    const running = box === 'v' ? holdStart[key] : undefined
    const storedValue = box === 'w' ? stored?.weight : box === 'r' ? stored?.reps : stored?.[single.field]
    // A flagged row keeps showing what was typed before, in its first box.
    const shown = running
      ? formatClock((now - running) / 1000)
      : draft !== undefined
        ? draft
        : confirmed
          ? storedValue !== undefined
            ? String(storedValue)
            : ''
          : flagged && box !== 'r'
            ? (stored?.raw ?? '')
            : ''
    // D-053: without last week's value, the prescription shows but cannot be confirmed.
    const hint =
      box === 'w'
        ? weightHint(row)
        : box === 'r'
          ? (exact?.reps ?? repRangeText(current.resolved.repMin, current.resolved.repMax))
          : (exact?.[single.field] ?? prescriptionPlaceholder(current.resolved))
    const state = error
      ? 'dk-field--error'
      : running || draft !== undefined || (!confirmed && !flagged)
        ? 'dk-field--active'
        : flagged
          ? 'dk-field--flagged'
          : 'dk-field--confirmed'
    const what = box === 'w' ? 'weight' : box === 'r' ? 'reps' : single.kind
    return (
      <div className="dk-boxcol" key={`${row.side ?? ''}${box}`}>
        <div className={`dk-field dk-field--box ${state}${typeof hint === 'string' && hint.includes('–') ? ' dk-field--range' : ''}`}>
          {row.side && box !== 'r' && <span className="dk-field__side">{row.side}</span>}
          <input
            {...numberBoxAttributes(id)}
            data-set-box=""
            inputMode={box === 'w' || (box === 'v' && single.decimal) ? 'decimal' : 'numeric'}
            enterKeyHint={box === 'w' ? 'next' : 'done'}
            value={shown}
            readOnly={running !== undefined}
            placeholder={hint !== undefined && hint !== '' ? String(hint) : ''}
            aria-label={`Set ${row.n}${row.side ? ` ${row.side}` : ''} ${what}${firstTime ? ', first time' : ''}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onFocus={(event) => {
              collapseDemo()
              setFocusLabel(`Set ${row.n}${row.side ? ` ${row.side}` : ''} · ${what}`)
              document.documentElement.dataset.setFocus = ''
              // The keyboard's arrows move focus here too, so this covers them.
              const container = event.currentTarget.closest<HTMLElement>('.dk-set__row')
              if (container) void centreInVisibleArea(container)
              event.currentTarget.select()
            }}
            onChange={(event) => {
              const text = event.target.value
              setDrafts((d) => ({ ...d, [boxKey(key, box)]: text }))
              setErrors((e) => {
                if (!(boxKey(key, box) in e)) return e
                const next = { ...e }
                delete next[boxKey(key, box)]
                return next
              })
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              // Enter or Next on Weight moves to Reps; on the last box it saves.
              if (box === 'w') document.getElementById(id.replace(/-w$/, '-r'))?.focus()
              else void saveRow(row)
            }}
            onBlur={(event) => {
              // Moving to another set box keeps the label and the footer in flow.
              if (!(event.relatedTarget instanceof HTMLElement && 'setBox' in event.relatedTarget.dataset)) {
                setFocusLabel(null)
                delete document.documentElement.dataset.setFocus
              }
              // One-box rows save on leaving the box, as before; load rows save on the tick or Enter.
              if (box === 'v' && draft !== undefined && draft.trim() !== '') void saveRow(row)
            }}
          />
          {!running && <span className="dk-field__unit">{box === 'w' ? unit : box === 'r' ? 'reps' : single.unit}</span>}
        </div>
        {error && (
          <div className="dk-box-error" id={`${id}-error`} role="alert">
            {error}
          </div>
        )}
      </div>
    )
  }

  /** The tick: saves the set's boxes (D-051), or marks a saved set. */
  function renderTick(rows: SetRow[]) {
    if (!current) return null
    const typed = rows.some((row) => (['w', 'r', 'v'] as Box[]).some((box) => drafts[boxKey(rowKey(current.item.id, row), box)] !== undefined))
    if (rows.every((row) => isSetConfirmed(findSet(entry, row))) && !typed) {
      return (
        <span className="dk-mark">
          <TickIcon />
        </span>
      )
    }
    return (
      <button
        type="button"
        className="dk-tick"
        aria-label={`Save set ${rows[0].n}${rows.length === 1 && rows[0].side ? ` ${rows[0].side}` : ''}`}
        onClick={() =>
          void (async () => {
            for (const row of rows) if (!(await saveRow(row))) return
          })()
        }
      >
        <TickIcon />
      </button>
    )
  }

  // D-065 rule 5: today's rows include the sets added during the session.
  const addedSets = entry?.addedSets ?? 0
  const baseSets = Math.max(1, current.resolved.sets ?? 1)
  const setNumbers = Array.from({ length: baseSets + addedSets }, (_, i) => i + 1)
  // The chip and the hint sit under the first row still waiting for a value.
  const pendingN = setNumbers.find((n) => {
    const rows: SetRow[] = current.resolved.perSide ? [{ n, side: 'L' }, { n, side: 'R' }] : [{ n }]
    return rows.some((row) => !isSetConfirmed(findSet(entry, row)))
  })

  function applySuggestion() {
    if (!current || !suggestion || suggestion.kind !== 'weight') return
    const fills: Record<string, string> = {}
    for (const row of setRowsWithAdded(current.resolved, entry?.addedSets)) {
      if (isSetConfirmed(findSet(entry, row))) continue
      // D-051: the chip fills Weight; Reps keeps its own placeholder.
      fills[boxKey(rowKey(current.item.id, row), 'w')] = String(suggestion.to)
    }
    setDrafts((d) => ({ ...d, ...fills }))
  }

  const restTotal = restSec ?? current.resolved.restSec ?? 0
  const lastDone = [...setNumbers].reverse().find((n) => {
    const rows: SetRow[] = current.resolved.perSide ? [{ n, side: 'L' }, { n, side: 'R' }] : [{ n }]
    return rows.every((row) => isSetConfirmed(findSet(entry, row)))
  })
  const restWords =
    isCheckTile || isCardioTile
      ? `Breathe. ${exercise?.name ?? 'This one'} is next.`
      : pendingN !== undefined
        ? lastDone
          ? `${lastDone === 1 ? 'Good first set' : `Set ${lastDone} done`}. Breathe, set ${pendingN} is next.`
          : `Breathe. Set ${pendingN} is next.`
        : `Breathe. ${next ? `${nameOf(next.resolved.exerciseId ?? '')} is next.` : 'That was the last one.'}`
  const referenceLine = referenceEntry ? entryLine(referenceEntry.sets.filter(isSetConfirmed), unit) : ''
  const activeN = editingN ?? pendingN
  const cardioKey = boxKey(rowKey(current.item.id, { n: 1 }), 'v')
  const cardioValue = drafts[cardioKey] ?? (findSet(entry, { n: 1 })?.minutes !== undefined ? String(findSet(entry, { n: 1 })?.minutes) : '')
  const cardioMinutes = Number(cardioValue || current.resolved.minutes || 0)
  const setCardio = (minutes: number) => setDrafts((d) => ({ ...d, [cardioKey]: String(Math.max(0, minutes)) }))

  /** One set (2.04, 2.05): done rows fold to a line, the active one opens with its boxes, later ones show last week. */
  function renderSet(n: number) {
    if (!current) return null
    const rows: SetRow[] = current.resolved.perSide ? [{ n, side: 'L' }, { n, side: 'R' }] : [{ n }]
    const flaggedRow = rows.find((row) => isSetFlagged(findSet(entry, row)))
    const typed = rows.some((row) => (['w', 'r', 'v'] as Box[]).some((box) => drafts[boxKey(rowKey(current.item.id, row), box)] !== undefined || errors[boxKey(rowKey(current.item.id, row), box)] !== undefined))
    const allConfirmed = rows.every((row) => isSetConfirmed(findSet(entry, row)))
    const setRef = (element: HTMLDivElement | null) => {
      rowRefs.current[`${current.item.id}:${n}`] = element
    }
    // D-054 rule 5: the last-week cell only when this exact row has last week's value.
    const refCell = (row: SetRow) => {
      const reference = exactReference(row)
      return reference ? <span className="dk-set__ref">{formatSetValue(reference)}</span> : null
    }
    const isLoad = (current.resolved.type ?? 'load_reps') === 'load_reps'
    const active = n === activeN || typed || flaggedRow !== undefined || holdStart[rowKey(current.item.id, rows[0])] !== undefined
    const extra = (
      <>
        {flaggedRow && <div className="dk-flag">Couldn&apos;t read this. Tap to fix.</div>}
        {/* D-065 rule 5: the last added set, with nothing saved, can be removed. */}
        {n === baseSets + addedSets && n > baseSets && !rows.some((row) => findSet(entry, row)) && (
          <button
            type="button"
            className="dk-addset dk-addset--remove"
            onClick={() => {
              for (const row of rows) clearBoxes(rowKey(current.item.id, row))
              void api.changeAddedSets(current.item.id, exerciseId, -1)
            }}
          >
            Remove set {n}
          </button>
        )}
        {n === pendingN && suggestion && (
          suggestion.kind === 'weight' ? (
            <button type="button" className="dk-chip" onClick={applySuggestion}>
              ↑ {suggestionText(suggestion)}
            </button>
          ) : (
            <div className="dk-chip dk-chip--note">{suggestionText(suggestion)}</div>
          )
        )}
      </>
    )
    if (allConfirmed && !active) {
      const text = rows.map((row) => {
        const set = findSet(entry, row)!
        const value = set.weight !== undefined && set.reps !== undefined ? `${set.weight} ${unit} × ${set.reps}` : formatSetValue(set)
        return row.side ? `${row.side} ${value}` : value
      })
      return (
        <div className="dk-set" key={n}>
          <button type="button" className="set-done" onClick={() => setEditingN(n)} aria-label={`Set ${n}: ${text.join(', ')}. Edit`}>
            <span className="set-done__n">Set {n}</span>
            <span className="set-done__value">{text.join(' · ')}</span>
            <span className="set-done__tick" aria-hidden="true">
              <Tick />
            </span>
          </button>
          {extra}
        </div>
      )
    }
    if (!active) {
      const reference = rows.map((row) => exactReference(row)).find(Boolean)
      return (
        <div className="dk-set" key={n}>
          <button type="button" className="set-later" onClick={() => setEditingN(n)}>
            <span className="set-later__n">Set {n}</span>
            <span className="set-later__ref">{reference ? `Last week ${formatSetValue(reference)}` : isLoad && n > 1 ? 'Same weight' : prescriptionPlaceholder(current.resolved)}</span>
          </button>
          {extra}
        </div>
      )
    }
    return (
      <div className="dk-set" key={n}>
        <div className="set-active">
          {isLoad ? (
            // D-051: Weight and Reps side by side; one line per side for per-side items.
            rows.map((row, i) => (
              <div className="dk-set__row dk-set__row--boxes dk-set__row--load" key={row.side ?? 'set'} ref={i === 0 ? setRef : undefined}>
                <span className="dk-set__n">{i === 0 ? `Set ${n}` : ''}</span>
                {refCell(row)}
                {renderBox(row, 'w')}
                {renderBox(row, 'r')}
                {renderTick([row])}
              </div>
            ))
          ) : (
            <div className="dk-set__row dk-set__row--boxes" ref={setRef}>
              <span className="dk-set__n">Set {n}</span>
              {!current.resolved.perSide && refCell(rows[0])}
              {current.resolved.perSide ? <div className="dk-pair">{rows.map((row) => renderBox(row, 'v'))}</div> : renderBox(rows[0], 'v')}
              {renderTick(rows)}
            </div>
          )}
        </div>
        {extra}
      </div>
    )
  }

  const holdKey = current.resolved.type === 'timed_hold' && activeN !== undefined ? rowKey(current.item.id, current.resolved.perSide ? { n: activeN, side: 'L' } : { n: activeN }) : null
  const holdStarted = holdKey ? holdStart[holdKey] : undefined
  const holdTarget = current.resolved.holdSec ?? 0

  return (
    <div className="screen screen--deck">
      <AppHeader
        context={formatTrainContext(today, week)}
        title={day.focus ?? day.name}
        aside={isCheckTile && !current.logged ? current.section.title : `${current.position} of ${deck.length}`}
        action={
          <>
            <button type="button" className="pill-action" aria-label="Today's plan" onClick={() => setPlanOpen(true)}>
              Plan
            </button>
            <button type="button" className="dk-end" onClick={endFlow}>
              End
            </button>
          </>
        }
      />
      {!resumeAsked && setsLogged > 0 && (
        <div className="tl-state">
          <StateBlock
            mark="↺"
            title="Pick up where you left off?"
            body={`${day.focus ?? day.name} · ${current.section.title}, ${current.position} of ${deck.length} · ${setsLogged} ${setsLogged === 1 ? 'set' : 'sets'} logged.`}
            primary={{ label: 'Resume', onClick: () => setResumeAsked(true) }}
            secondary={{
              label: 'End session',
              onClick: () => {
                setResumeAsked(true)
                void api.end()
                setPhase('summary')
              },
            }}
          />
        </div>
      )}
      {saveFailed && (
        <div className="tl-state">
          <StateBlock
            role="alert"
            mark="!"
            title="Couldn't save that set"
            body="It’s still on screen. Try again; nothing else is lost."
            primary={{
              label: 'Try again',
              onClick: () => void saveRow(saveFailed.row),
            }}
          />
        </div>
      )}

      <section className="card-v3 ex-card">
        <span className="ex-card__section">{current.section.title}</span>
        <h1 className="ex-card__name">
          {exercise?.name ?? exerciseId}
          {current.resolved.index && <span className="tl-tag">index</span>}
        </h1>
        <span className="ex-card__sub">
          {isCheckTile && !current.logged ? 'Tick it when it’s done' : prescriptionSentence(current.resolved)}
          {referenceLine && !isCheckTile ? ` · last week ${referenceLine}` : ''}
          {current.resolved.tempo ? ` · tempo ${current.resolved.tempo}` : ''}
          {current.resolved.restSec && !isCheckTile ? ` · rest ${formatRest(current.resolved.restSec)}` : ''}
          {current.resolved.rpe ? ` · RPE ${current.resolved.rpe}` : ''}
        </span>
        {current.resolved.cue && <span className="ex-card__cue">{current.resolved.cue}</span>}

        {restRemaining > 0 && (
          <div className="rest-panel">
            <ProgressRing value={restTotal > 0 ? restRemaining / restTotal : 0} size={96} stroke={8} label={`Rest ${formatClock(restRemaining)}`}>
              <span className="dk-rest__value rest-panel__clock">{formatClock(restRemaining)}</span>
            </ProgressRing>
            <div className="rest-panel__side">
              <span className="rest-panel__words">{restWords}</span>
              <div className="rest-panel__buttons">
                <button type="button" className="rest-btn" onClick={() => {
                  setRestUntil((until) => (until ?? Date.now()) + 15000)
                  setRestSec((sec) => (sec ?? restTotal) + 15)
                }}>
                  +15 s
                </button>
                <button type="button" className="rest-btn" onClick={() => setRestUntil(null)}>
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {holdKey && !entry?.skipped && (
          <div className="hold-panel">
            <ProgressRing value={holdTarget > 0 && holdStarted ? Math.min(1, (now - holdStarted) / 1000 / holdTarget) : 0} size={176} stroke={8} label="Hold timer">
              <span className="hold-panel__clock">{formatClock(holdStarted ? (now - holdStarted) / 1000 : 0)}</span>
              {holdTarget > 0 && <span className="hold-panel__of">of {formatClock(holdTarget)}</span>}
            </ProgressRing>
            <span className="hold-panel__words">{holdStarted ? `Holding, set ${activeN}. Keep breathing.` : `Set ${activeN}. Start when you're in position.`}</span>
          </div>
        )}
        {holdKey && !entry?.skipped && activeN !== undefined && (
          <div className="ex-card__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                const row: SetRow = current.resolved.perSide ? { n: activeN, side: 'L' } : { n: activeN }
                const key = rowKey(current.item.id, row)
                if (holdStart[key]) {
                  const seconds = Math.round((Date.now() - holdStart[key]) / 1000)
                  setHoldStart((h) => {
                    const nextHolds = { ...h }
                    delete nextHolds[key]
                    return nextHolds
                  })
                  void api.writeSet(current.item.id, exerciseId, { n: row.n, ...(row.side ? { side: row.side } : {}), seconds }).then(() => {
                    setEditingN(null)
                    startRest()
                  })
                } else {
                  setHoldStart((h) => ({ ...h, [key]: Date.now() }))
                }
              }}
            >
              {holdStarted ? 'Stop and log' : 'Start the timer'}
            </button>
            {holdTarget > 0 && !holdStarted && (
              <button
                type="button"
                className="btn btn--tertiary"
                onClick={() => {
                  const row: SetRow = current.resolved.perSide ? { n: activeN, side: 'L' } : { n: activeN }
                  void writeRow(row, { seconds: holdTarget }).then(() => setEditingN(null))
                }}
              >
                Log {holdTarget} s without the timer
              </button>
            )}
          </div>
        )}

        {isCardioTile && !entry?.skipped && (
          <>
            <div className="cardio-panel">
              <button type="button" className="cardio-panel__step" aria-label="One minute less" onClick={() => setCardio(cardioMinutes - 1)}>
                −
              </button>
              <div className="cardio-panel__value">
                {cardioStart ? (
                  <span className="cardio-panel__clock">{formatClock((now - cardioStart) / 1000)}</span>
                ) : (
                  <input
                    {...numberBoxAttributes('box-cardio-min')}
                    className="cardio-panel__input"
                    inputMode="numeric"
                    aria-label="Minutes"
                    value={cardioValue}
                    placeholder={String(current.resolved.minutes ?? '')}
                    onChange={(event) => setDrafts((d) => ({ ...d, [cardioKey]: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    onBlur={(event) => {
                      if (event.target.value.trim() === '') return
                      void saveRow({ n: 1 })
                    }}
                  />
                )}
                <span className="cardio-panel__unit">minutes</span>
              </div>
              <button type="button" className="cardio-panel__step" aria-label="One minute more" onClick={() => setCardio(cardioMinutes + 1)}>
                +
              </button>
            </div>
            <div className="ex-card__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() =>
                  void (async () => {
                    // The stepper's minutes are what Done saves; with none, Done behaves as before.
                    const stored = findSet(entry, { n: 1 })?.minutes
                    if (cardioMinutes > 0 && (drafts[cardioKey] !== undefined || stored === undefined)) {
                      if (await writeRow({ n: 1 }, { minutes: cardioMinutes }, 'done')) advance(deck.indexOf(current))
                      return
                    }
                    await done()
                  })()
                }
              >
                Done{cardioMinutes > 0 ? `, ${cardioMinutes} min` : ''}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                aria-label={cardioStart ? 'Stop timer' : 'Start timer'}
                onClick={() => {
                  if (cardioStart) {
                    const minutes = Math.max(1, Math.round((Date.now() - cardioStart) / 60000))
                    setCardioStart(null)
                    setDrafts((d) => ({ ...d, [cardioKey]: String(minutes) }))
                  } else {
                    setCardioStart(Date.now())
                  }
                }}
              >
                {cardioStart ? `Stop the timer, ${formatClock((now - cardioStart) / 1000)}` : `Start a ${current.resolved.minutes ?? cardioMinutes} min timer`}
              </button>
            </div>
            <textarea
              className="dk-note"
              placeholder="Note"
              aria-label="Session note"
              defaultValue={entry?.note ?? ''}
              onBlur={(event) => void api.setNote(current.item.id, exerciseId, event.target.value)}
            />
          </>
        )}

        {demoExpanded ? (
          <div className="ex-card__demo">
            <div className="dk-demo">
              <DemoMedia exercise={exercise} />
              <button type="button" className="dk-demo__hide" onClick={() => setDemoOpen((d) => ({ ...d, [at]: false }))}>
                Hide
              </button>
            </div>
            {steps.map((step, i) => (
              <div className="dk-step" key={i}>
                <b>{i + 1}</b>
                <span>{step}</span>
              </div>
            ))}
          </div>
        ) : (
          <button type="button" className="ex-card__demo-link" onClick={() => setDemoOpen((d) => ({ ...d, [at]: true }))}>
            Show demo and how-to
          </button>
        )}
      </section>

      <div className="dk-body">
        {entry?.skipped ? (
          <p className="note-v3">Skipped today: discomfort.</p>
        ) : isCheckTile ? (
          <button
            type="button"
            className={checked ? 'check-row check-row--on' : 'check-row'}
            aria-pressed={checked}
            aria-label={checked ? 'Checked' : 'Not checked'}
            onClick={() => void api.setChecked(current.item.id, exerciseId, !checked)}
          >
            <span className="check-row__text">
              <span className="check-row__name">{exercise?.name ?? exerciseId}</span>
              {prescriptionText(current.resolved) && <span className="check-row__sub">{prescriptionText(current.resolved)}</span>}
            </span>
            <span className="check-row__mark" aria-hidden="true">
              {checked && <Tick />}
            </span>
          </button>
        ) : isCardioTile ? null : (
          setNumbers.map((n) => renderSet(n))
        )}

        <div className="dk-tools">
          {!entry?.skipped && !isCheckTile && !isCardioTile && (
            <button type="button" className="chip dk-addset" onClick={() => void api.changeAddedSets(current.item.id, exerciseId, 1)}>
              + Add set
            </button>
          )}
          <button type="button" className="chip dk-tool" onClick={() => setSheet('swap')}>
            Swap
          </button>
          <button
            type="button"
            className={entry?.feltOff ? 'chip chip--on dk-tool dk-tool--on' : 'chip dk-tool'}
            onClick={() => {
              setFeltChoice(entry?.feltOff ?? null)
              setSheet('felt')
            }}
          >
            {entry?.feltOff ? `Felt off: ${FELT_WORD[entry.feltOff]}` : 'Felt off'}
          </button>
          {swapTo && (
            <button type="button" className="chip dk-tool" onClick={() => void api.chooseExercise(current.item.id, swapTo)}>
              Use {nameOf(swapTo)} instead
            </button>
          )}
        </div>

        {next && (
          <section className="card-v3 up-next">
            <span className="ex-card__section">Up next</span>
            <span className="up-next__name">{nameOf(next.resolved.exerciseId ?? '')}</span>
            <span className="ex-card__sub">{prescriptionSentence(next.resolved)}</span>
          </section>
        )}
      </div>

      {focusLabel && <FocusLabel text={focusLabel} />}
      <div className={focusLabel ? 'dk-foot dk-foot--flow' : 'dk-foot'}>
        <div className="dk-actions">
          <button
            type="button"
            className="dk-back"
            aria-label="Previous item"
            disabled={at === 0}
            onClick={() => {
              setPosition(Math.max(0, at - 1))
              setEditingN(null)
              window.scrollTo({ top: 0 })
            }}
          >
            <ChevronLeftIcon />
          </button>
          <button type="button" className="dk-donebtn deck-done" onClick={() => void done()}>
            {next ? 'Done' : 'Finish workout'}
          </button>
        </div>
      </div>

      {endAsked && (
        <Dialog
          title="End this workout?"
          body={endDialogBody(doneForEnd)}
          cancelLabel="Keep going"
          confirmLabel="End workout"
          danger
          onCancel={() => setEndAsked(false)}
          onConfirm={() => {
            setEndAsked(false)
            window.scrollTo({ top: 0 })
            void api.end()
            setPhase('summary')
          }}
        />
      )}
      {planOpen && (
        <PlanSheet
          deck={deck}
          order={orderOf(deck)}
          currentIndex={at}
          done={doneIds}
          inProgress={inProgressIds}
          nameOf={(d) => nameOf(findEntry(api.session ?? undefined, d.item.id)?.exerciseId ?? d.resolved.exerciseId ?? '')}
          onJump={(index) => {
            setPlanOpen(false)
            setEditingN(null)
            setPosition(index)
            window.scrollTo({ top: 0 })
          }}
          onMove={(itemId, toIndex, toSectionId) => void moveInPlan(itemId, toIndex, toSectionId)}
          sections={day.sections}
          onAddExercise={() => {
            setPlanOpen(false)
            setAdding(true)
          }}
          onChangeDay={
            // D-074 rule 6, D-075 rule 1: not when today's current workout has ended.
            canChangeDate(todayIso, todayIso, history.filter((s) => s.id !== api.session?.id), day.id)
              ? () => {
                  setPlanOpen(false)
                  setChangingDay(true)
                }
              : null
          }
          onEnd={() => {
            setPlanOpen(false)
            endFlow()
          }}
          onClose={() => setPlanOpen(false)}
        />
      )}
      {changingDay && (
        <ChangeDay
          program={program}
          date={today}
          current={day}
          isToday
          week={week}
          loggedToday={setsLogged > 0}
          onClose={() => setChangingDay(false)}
          onConfirm={async (dayId) => {
            // Rule 4: today's session ends as it stands; what was logged stays.
            blurSetBox(document)
            if (api.session) await api.finish()
            await setChange(todayIso, dayId)
            window.scrollTo({ top: 0 })
          }}
        />
      )}
      {sheet === 'felt' && (
        <Sheet
          title={`How did ${lowerFirst(exercise?.name ?? exerciseId)} feel?`}
          body="Saved with today's session."
          onClose={() => setSheet(null)}
        >
          <div style={{ marginTop: -8, borderTop: '1.5px solid var(--text)' }} role="radiogroup" aria-label="How did it feel?">
            {FELT.map((f) => (
              <ChoiceRow key={f.value} title={f.title} sub={f.sub} on={feltChoice === f.value} onClick={() => setFeltChoice(f.value)} />
            ))}
          </div>
          <div className="ai-pair">
            <button type="button" className="ob-outline" onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="ob-primary"
              onClick={() => {
                const from = deck.indexOf(current)
                void api.setFeltOff(current.item.id, exerciseId, feltChoice).then(() => {
                  setSheet(null)
                  // Discomfort skips the rest of this exercise today.
                  if (feltChoice === 'discomfort') advance(from)
                })
              }}
            >
              <span>Save</span>
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
