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
import { readDraft } from '../builder/draft.ts'
import { howToSteps, lowerFirst } from '../lib/builder.ts'
import { formatLongDate, toISODate } from '../lib/dates.ts'
import { parseSet, type ParsedFields } from '../lib/parseSet.ts'
import { loadRowOutcome, numberBoxAttributes, repRangeText, singleRowOutcome, type BoxResult, type RowAction } from '../lib/setBoxes.ts'
import { formatClock, formatRest, formatSetValue, prescriptionText } from '../lib/prescription.ts'
import { dayForDate } from '../lib/program.ts'
import { suggestProgression, suggestionText } from '../lib/progression.ts'
import {
  buildDeck,
  findEntry,
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
  isDeckItemDone,
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
import { PlanSheet } from './PlanSheet.tsx'
import { useProgram } from '../program/useProgram.ts'
import { useSession } from '../session/useSession.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Exercise, ItemFields } from '../types/program.ts'
import type { Entry, FeltOff, Session, SetLog } from '../types/stores.ts'
import { ChevronLeftIcon, PlayIcon } from '../ui/icons.tsx'
import { StateBlock } from '../ui/StateBlock.tsx'

const DEMO_SEEN = 'demoSeen'

const FELT: { value: FeltOff; title: string; sub?: string }[] = [
  { value: 'easy', title: 'Too easy' },
  { value: 'hard', title: 'Too hard' },
  { value: 'discomfort', title: 'Discomfort', sub: 'Skips the rest of this exercise today' },
]
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
 * row at the centre of the visible area.
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
  const visibleCentre = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) / 2
  window.scrollBy({ top: rect.top + rect.height / 2 - visibleCentre, behavior: 'smooth' })
}

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

export function DeckScreen() {
  const { program, today, week, weekPlan, refresh } = useProgram()
  const { settings } = useSettings()
  const navigate = useNavigate()
  // Today's Resume button already asked; a reopened deck asks here (7b).
  const fromToday = (useLocation().state as { fromToday?: boolean } | null)?.fromToday === true
  const { templates } = useStarterTemplates()
  const library = useLibrary(program, templates)

  const day = program ? dayForDate(program, weekPlan, today) : null
  const scheduled = program?.days.find((d) => d.order === today.getDay())
  const swapped = Boolean(scheduled && day && scheduled.id !== day.id)
  const todayIso = toISODate(today)
  const isNew = settings.onboarding?.experience === 'new'

  const target = useMemo(
    () => (day ? { date: todayIso, dayId: day.id, programWeek: week, swapped } : null),
    [day, todayIso, week, swapped],
  )
  const api = useSession(target)
  // The program's deck, and today's: the session's order applied (D-063, D-065 rule 1).
  const baseDeck = useMemo(() => (day ? buildDeck(day, week, today) : []), [day, week, today])
  const sessionOrder = api.session?.order
  const deck = useMemo(() => (day ? applyOrder(baseDeck, day, sessionOrder) : baseDeck), [baseDeck, day, sessionOrder])

  // Where the user has navigated to with Done or Back. Null until they move.
  const [position, setPosition] = useState<number | null>(null)
  // Where Resume dropped them, decided once when the stored session arrives.
  const [startAt, setStartAt] = useState<number | null>(null)
  const [phase, setPhase] = useState<'deck' | 'summary'>('deck')
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
  const [kept, setKept] = useState<{ sets: Record<string, boolean>; order: boolean }>({ sets: {}, order: false })
  const [keepError, setKeepError] = useState<string | null>(null)
  const [draftWaiting, setDraftWaiting] = useState<boolean | null>(null)
  const seen = useRef<string[]>([])
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

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
  const at = position ?? startAt ?? 0
  const current: DeckItem | undefined = deck[at]
  const entry = findEntry(api.session ?? undefined, current?.item.id ?? '')
  const exerciseId = entry?.exerciseId ?? current?.resolved.exerciseId ?? ''
  const exercise: Exercise | undefined = program?.exercises[exerciseId] ?? library.find((l) => l.id === exerciseId)?.exercise
  const referenceEntry = useMemo(
    () => (day ? findReferenceEntry(history, day.id, exerciseId) : undefined),
    [history, day, exerciseId],
  )
  const unit = current?.resolved.unit ?? 'kg'

  // D-033: a New user sees each exercise's demo open the first time it appears.
  const firstView = isNew && seenAtLoad !== null && Boolean(exerciseId) && !seenAtLoad.includes(exerciseId)
  const demoExpanded = demoOpen[at] ?? firstView
  useEffect(() => {
    if (!firstView || seen.current.includes(exerciseId)) return
    seen.current = [...seen.current, exerciseId]
    void setMeta(DEMO_SEEN, JSON.stringify(seen.current))
  }, [firstView, exerciseId])

  // D-047: this item's recent entries with this exercise, newest first.
  const suggestion = useMemo(() => {
    if (!current) return null
    const past: Entry[] = [...history]
      .filter((s) => s.date < todayIso)
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap((s) => s.entries.filter((e) => e.itemId === current.item.id && e.exerciseId === exerciseId))
    return suggestProgression({ ...current.resolved, progression: current.item.progression }, exercise, past, unit)
  }, [current, history, todayIso, exerciseId, exercise, unit])

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
    if (restSec && restSec > 0) setRestUntil(Date.now() + restSec * 1000)
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

  const writeRow = useCallback(
    async (row: SetRow, fields: ParsedFields) => {
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
      startRest()
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
        return writeRow(row, result.fields)
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
        return writeRow(row, { weight: outcome.weight, reps: outcome.reps })
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
      return writeRow(row, { [single.field]: outcome.value })
    },
    [current, entry, drafts, prefillFor, exactReference, writeRow],
  )

  const advance = useCallback(
    (from: number) => {
      if (from >= deck.length - 1) {
        setPhase('summary')
        window.scrollTo({ top: 0 })
        return
      }
      setPosition(from + 1)
      window.scrollTo({ top: 0 })
    },
    [deck.length],
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
    for (const row of setRowsWithAdded(current.resolved, entry?.addedSets)) {
      const key = rowKey(current.item.id, row)
      const hasTyped = (['w', 'r', 'v'] as Box[]).some((box) => (drafts[boxKey(key, box)] ?? '').trim() !== '')
      const stored = findSet(entry, row)
      // Typed boxes must save; an untouched row saves only last week's values
      // for that row, and is otherwise left empty (D-053).
      const saved = stored && !hasTyped ? true : await saveRow(row, 'done')
      if (!saved) return
    }
    advance(from)
  }, [api, current, deck, exerciseId, drafts, entry, saveRow, advance])

  // D-065 rule 8: Keep controls wait for any builder draft to be finished or discarded.
  useEffect(() => {
    if (phase !== 'summary') return
    let live = true
    void readDraft().then((draft) => live && setDraftWaiting(draft !== null))
    return () => {
      live = false
    }
  }, [phase])

  const finish = useCallback(async () => {
    await api.finish()
    navigate('/', { replace: true })
  }, [api, navigate])

  // Wait for the stored session before choosing where to resume.
  if (!program || !day || api.loading) return null
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
  const notDone = deck.length - doneIds.size
  const restRemaining = restUntil ? (restUntil - now) / 1000 : 0
  const nameOf = (id: string) => program.exercises[id]?.name ?? library.find((l) => l.id === id)?.exercise.name ?? id

  /** End, from the header or the plan sheet: asks first when items are not done (7b). */
  const endFlow = () => {
    window.scrollTo({ top: 0 })
    if (notDone > 0) setEndAsked(true)
    else setPhase('summary')
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
        return kept.sets[deckItem.item.id] || ((recorded?.addedSets ?? 0) > 0 && n > (deckItem.item.sets ?? 1))
      })
    const orderOffered = kept.order || (Boolean(session?.order) && orderDiffers(deck, baseDeck))
    if (added.length === 0 && !orderOffered) return null

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
        await saveProgram(keepOrder(latest, day.id, orderOf(deck), loggedToday))
        await refresh()
        setKept((k) => ({ ...k, order: true }))
      } catch (e) {
        setKeepError(`Could not keep it: ${(e as Error).message}`)
      }
    }

    return (
      <div className="dk-keep">
        <div className="ob-sechead">
          <span>Change the program?</span>
        </div>
        {draftWaiting === null ? null : draftWaiting ? (
          <p className="dk-keep__note">Finish or discard your program draft first to keep these changes.</p>
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
                  <button type="button" className="ai-btn" onClick={() => void keepAdded(deckItem.item.id, n)}>
                    Keep {n} sets in program
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
                  <button type="button" className="ai-btn" onClick={() => void keepTodaysOrder()}>
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
      </div>
    )
  }

  // ── 3g Session summary ──
  if (phase === 'summary') {
    const felt = (api.session?.entries ?? []).filter((e) => e.feltOff)
    const minutes =
      summary.durationMin ?? Math.max(0, Math.round((now - new Date(api.session?.startedAt ?? now).getTime()) / 60000))
    return (
      <div className="tl" style={{ paddingBottom: 130 }}>
        <div className="dk-progress dk-progress--done" style={{ marginTop: 8 }}>
          <span style={{ width: '100%' }} />
        </div>
        <div className="bd-hero">
          <h1 className="bd-hero__title" style={{ fontSize: 40 }}>
            Session complete
          </h1>
          <div className="bd-hero__sub">
            {formatLongDate(today)} · {day.focus ?? day.name} · week {week} of {program.programWeeks}
          </div>
        </div>
        <div style={{ margin: '20px 24px 0', borderTop: '1.5px solid var(--text)' }}>
          <div className="dk-stat">
            <span className="dk-stat__label">Sets done</span>
            <span className="dk-stat__value">{summary.setsConfirmed}</span>
          </div>
          {summary.volumeByUnit.map(({ unit: u, volume }) => (
            <div className="dk-stat" key={u}>
              <span className="dk-stat__label">Volume, {u}</span>
              <span className="dk-stat__value">{volume.toLocaleString('en-US')}</span>
            </div>
          ))}
          <div className="dk-stat">
            <span className="dk-stat__label">Time</span>
            <span className="dk-stat__value">{minutes} min</span>
          </div>
          <div className="dk-stat">
            <span className="dk-stat__label">Skipped</span>
            <span className="dk-stat__value">{summary.skipped}</span>
          </div>
        </div>
        {felt.length > 0 && (
          <div style={{ margin: '16px 24px 0', fontSize: 15, lineHeight: 1.45 }}>
            <span style={{ color: 'var(--secondary)' }}>Felt off:</span>{' '}
            {felt.map((e) => `${lowerFirst(nameOf(e.exerciseId))}, ${FELT_WORD[e.feltOff!]}`).join('; ')}.
          </div>
        )}
        {swapped && (
          <div className="banner" style={{ marginTop: 12 }}>
            <span>Logged as {day.name}&apos;s session (days swapped)</span>
          </div>
        )}
        {renderKeep()}
        <div className="ob-dock">
          <button type="button" className="tl-done" onClick={() => void finish()}>
            Finish
          </button>
        </div>
      </div>
    )
  }

  if (!current) return null

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
        onBack={() => setSheet(null)}
        onPick={(picked) => {
          void api.chooseExercise(current.item.id, picked.id)
          setSheet(null)
        }}
      />
    )
  }

  const next = deck[at + 1]
  const alternateId = current.resolved.alternateExerciseId
  const onAlternate = alternateId !== undefined && exerciseId === alternateId
  const swapTo = onAlternate ? current.resolved.exerciseId : alternateId
  const prescription = [
    prescriptionText(current.resolved),
    current.resolved.tempo ? `tempo ${current.resolved.tempo}` : null,
    current.resolved.restSec ? `rest ${formatRest(current.resolved.restSec)}` : null,
    current.resolved.rpe ? `RPE ${current.resolved.rpe}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

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

  function renderHoldButton(row: SetRow) {
    if (!current) return null
    const key = rowKey(current.item.id, row)
    const startedAt = holdStart[key]
    return (
      <button
        type="button"
        className={startedAt ? 'dk-hold dk-hold--running' : 'dk-hold'}
        aria-label={startedAt ? 'Stop hold timer' : 'Start hold timer'}
        onClick={() => {
          if (startedAt) {
            const seconds = Math.round((Date.now() - startedAt) / 1000)
            setHoldStart((h) => {
              const nextHolds = { ...h }
              delete nextHolds[key]
              return nextHolds
            })
            void api
              .writeSet(current.item.id, exerciseId, { n: row.n, ...(row.side ? { side: row.side } : {}), seconds })
              .then(() => startRest())
          } else {
            setHoldStart((h) => ({ ...h, [key]: Date.now() }))
          }
        }}
      >
        {startedAt ? <span /> : <PlayIcon />}
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

  return (
    <div className="tl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="dk-head">
        <span className="dk-head__section">
          {current.section.title} · {current.position} of {deck.length}
        </span>
        {restRemaining > 0 && (
          <span className="dk-rest">
            <span className="dk-rest__label">rest</span>
            <span className="dk-rest__value">{formatClock(restRemaining)}</span>
          </span>
        )}
        <button type="button" className="dk-planbtn" aria-label="Today's plan" onClick={() => setPlanOpen(true)}>
          Plan
        </button>
        <button
          type="button"
          className="dk-end"
          onClick={endFlow}
        >
          End
        </button>
      </div>
      <div className="dk-progress">
        <span style={{ width: `${(current.position / deck.length) * 100}%` }} />
      </div>
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
                setPhase('summary')
              },
            }}
          />
        </div>
      )}
      {endAsked && (
        <div className="tl-state">
          <StateBlock
            role="alert"
            mark="?"
            title="End this session?"
            body={`${notDone} ${notDone === 1 ? 'exercise is' : 'exercises are'} not done. What you logged is kept.`}
            primary={{ label: 'Keep going', onClick: () => setEndAsked(false) }}
            secondary={{
              label: 'End session',
              onClick: () => {
                setEndAsked(false)
                setPhase('summary')
                window.scrollTo({ top: 0 })
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

      <div className="dk-title">
        <h1 className="dk-title__name">
          {exercise?.name ?? exerciseId}
          {current.resolved.index && <span className="tl-tag">index</span>}
        </h1>
        {prescription && <div className="dk-title__sub">{prescription}</div>}
        {current.resolved.cue && <div className="dk-title__cue">{current.resolved.cue}</div>}
      </div>

      <div style={{ flex: 1, paddingBottom: 24 }}>
        {demoExpanded && (
          <div style={{ margin: '0 24px' }}>
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
        )}

        <div className="dk-body" style={demoExpanded ? { marginTop: 14 } : undefined}>
          {!demoExpanded && (
            <button type="button" className="dk-demo-row" onClick={() => setDemoOpen((d) => ({ ...d, [at]: true }))}>
              <span className="bd-demo" aria-hidden="true">
                <span>demo</span>
              </span>
              <span className="dk-demo-row__label">Show demo and how-to</span>
            </button>
          )}

          {entry?.skipped ? (
            <div className="dk-check">
              <span className="dk-check__label">Skipped today: discomfort.</span>
            </div>
          ) : isCheckTile ? (
            <div className="dk-check">
              <span className="dk-check__label">Tap when done</span>
              <button
                type="button"
                className={checked ? 'dk-checkbox dk-checkbox--on' : 'dk-checkbox'}
                aria-label={checked ? 'Checked' : 'Not checked'}
                onClick={() => void api.setChecked(current.item.id, exerciseId, !checked)}
              >
                <TickIcon />
              </button>
            </div>
          ) : isCardioTile ? (
            <>
              <div className="dk-cardio">
                <span className="dk-cardio__clock">{formatClock(cardioStart ? (now - cardioStart) / 1000 : 0)}</span>
                <div className="dk-cardio__of">
                  <span>of</span>
                  <input
                    {...numberBoxAttributes('box-cardio-min')}
                    inputMode="numeric"
                    aria-label="Minutes"
                    value={
                      drafts[boxKey(rowKey(current.item.id, { n: 1 }), 'v')] ??
                      (findSet(entry, { n: 1 })?.minutes !== undefined ? String(findSet(entry, { n: 1 })?.minutes) : '')
                    }
                    placeholder={String(current.resolved.minutes ?? '')}
                    onChange={(event) => setDrafts((d) => ({ ...d, [boxKey(rowKey(current.item.id, { n: 1 }), 'v')]: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    onBlur={(event) => {
                      if (event.target.value.trim() === '') return
                      void saveRow({ n: 1 })
                    }}
                  />
                  <span>min</span>
                </div>
                <button
                  type="button"
                  className={cardioStart ? 'dk-hold dk-hold--running' : 'dk-hold'}
                  aria-label={cardioStart ? 'Stop timer' : 'Start timer'}
                  onClick={() => {
                    if (cardioStart) {
                      const minutes = Math.max(1, Math.round((Date.now() - cardioStart) / 60000))
                      setCardioStart(null)
                      setDrafts((d) => ({ ...d, [boxKey(rowKey(current.item.id, { n: 1 }), 'v')]: String(minutes) }))
                    } else {
                      setCardioStart(Date.now())
                    }
                  }}
                >
                  {cardioStart ? <span /> : <PlayIcon />}
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
          ) : (
            setNumbers.map((n) => {
              const rows: SetRow[] = current.resolved.perSide ? [{ n, side: 'L' }, { n, side: 'R' }] : [{ n }]
              const flaggedRow = rows.find((row) => isSetFlagged(findSet(entry, row)))
              const holdRow =
                current.resolved.type === 'timed_hold'
                  ? (rows.find((row) => !isSetConfirmed(findSet(entry, row))) ?? rows[rows.length - 1])
                  : null
              const setRef = (element: HTMLDivElement | null) => {
                rowRefs.current[`${current.item.id}:${n}`] = element
              }
              // D-054 rule 5: the last-week cell only when this exact row has last week's value.
              const refCell = (row: SetRow) => {
                const reference = exactReference(row)
                return reference ? <span className="dk-set__ref">{formatSetValue(reference)}</span> : null
              }
              const isLoad = (current.resolved.type ?? 'load_reps') === 'load_reps'
              return (
                <div className="dk-set" key={n}>
                  {isLoad ? (
                    // D-051: Weight and Reps side by side; one line per side for per-side items.
                    rows.map((row, i) => (
                      <div className="dk-set__row dk-set__row--boxes dk-set__row--load" key={row.side ?? 'set'} ref={i === 0 ? setRef : undefined}>
                        <span className="dk-set__n">{i === 0 ? n : ''}</span>
                        {refCell(row)}
                        {renderBox(row, 'w')}
                        {renderBox(row, 'r')}
                        {renderTick([row])}
                      </div>
                    ))
                  ) : (
                    <div className="dk-set__row dk-set__row--boxes" ref={setRef}>
                      <span className="dk-set__n">{n}</span>
                      {!current.resolved.perSide && refCell(rows[0])}
                      {current.resolved.perSide ? <div className="dk-pair">{rows.map((row) => renderBox(row, 'v'))}</div> : renderBox(rows[0], 'v')}
                      {holdRow ? renderHoldButton(holdRow) : renderTick(rows)}
                    </div>
                  )}
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
                </div>
              )
            })
          )}
          {!entry?.skipped && !isCheckTile && !isCardioTile && (
            <button type="button" className="dk-addset" onClick={() => void api.changeAddedSets(current.item.id, exerciseId, 1)}>
              + Add set
            </button>
          )}

          <div className="dk-tools">
            <button
              type="button"
              className={entry?.feltOff ? 'dk-tool dk-tool--on' : 'dk-tool'}
              onClick={() => {
                setFeltChoice(entry?.feltOff ?? null)
                setSheet('felt')
              }}
            >
              {entry?.feltOff ? `Felt off: ${FELT_WORD[entry.feltOff]}` : 'Felt off'}
            </button>
            <button type="button" className="dk-tool" onClick={() => setSheet('swap')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M7 8h10M14 4.5L17.5 8 14 11.5M17 16H7M10 12.5L6.5 16l3.5 3.5" />
              </svg>
              Swap
            </button>
            {swapTo && (
              <button type="button" className="dk-tool" onClick={() => void api.chooseExercise(current.item.id, swapTo)}>
                Use {nameOf(swapTo)} instead
              </button>
            )}
          </div>
        </div>
      </div>

      {focusLabel && <FocusLabel text={focusLabel} />}
      <div className={focusLabel ? 'dk-foot dk-foot--flow' : 'dk-foot'}>
        {next && (
          <div className="dk-next">
            <span className="dk-next__name">
              <span className="dk-next__label">Next · </span>
              <b>{nameOf(next.resolved.exerciseId ?? '')}</b>
            </span>
            <span className="dk-next__label">{prescriptionText(next.resolved)}</span>
          </div>
        )}
        <div className="dk-actions" style={next ? undefined : { paddingTop: 10 }}>
          <button
            type="button"
            className="dk-back"
            aria-label="Previous item"
            disabled={at === 0}
            onClick={() => {
              setPosition(Math.max(0, at - 1))
              window.scrollTo({ top: 0 })
            }}
          >
            <ChevronLeftIcon />
          </button>
          <button type="button" className="dk-donebtn deck-done" onClick={() => void done()}>
            Done
          </button>
        </div>
      </div>

      {planOpen && (
        <PlanSheet
          deck={deck}
          order={orderOf(deck)}
          currentIndex={at}
          done={doneIds}
          nameOf={(d) => nameOf(findEntry(api.session ?? undefined, d.item.id)?.exerciseId ?? d.resolved.exerciseId ?? '')}
          onJump={(index) => {
            setPlanOpen(false)
            setPosition(index)
            window.scrollTo({ top: 0 })
          }}
          onMove={(itemId, toIndex, toSectionId) => void moveInPlan(itemId, toIndex, toSectionId)}
          onEnd={() => {
            setPlanOpen(false)
            endFlow()
          }}
          onClose={() => setPlanOpen(false)}
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
