// The forms path, frames 2e to 2j (EXEC-08 task 5, D-042). One draft,
// written to the meta store on every change; Save validates, hands the
// program back, and clears the draft.

import { useEffect, useMemo, useState } from 'react'

import {
  SECTION_ORDER,
  SECTION_TITLE,
  defaultItem,
  findItem,
  finishDraft,
  itemsLoggedOn,
  itemsWithHistory,
  lengthHint,
  lowerFirst,
  moveDay,
  newId,
  removeItem,
  reviewChecks,
  swapExercise,
  weeksOfHistory,
  withExercise,
} from '../lib/builder.ts'
import { toISODate } from '../lib/dates.ts'
import { sundayOnOrBefore } from '../lib/onboarding.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { parseISODate } from '../lib/program.ts'
import { Dock, HandleIcon, PrimaryButton, SectionHead, Segmented, Stepper } from '../onboarding/ui.tsx'
import type { Day, Item, LoadUnit, Program, Section, SectionKind } from '../types/program.ts'
import type { Session } from '../types/stores.ts'
import { clearDraft, draftWanted, writeDraft, type BuilderDraft, type DraftStep } from './draft.ts'
import { ExercisePicker } from './ExercisePicker.tsx'
import { ItemEditor } from './ItemEditor.tsx'
import { BuilderBar, CheckMark, ChevronRight, Hero, Sheet, StepBar } from './ui.tsx'
import { useDragReorder } from './useDragReorder.ts'
import { useLibrary, useStarterTemplates } from './useLibrary.ts'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LONG_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function endOf(program: Program): Date {
  const start = parseISODate(program.startDate)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + program.programWeeks * 7 - 1)
}

function sortedDays(program: Program): Day[] {
  return [...program.days].sort((a, b) => a.order - b.order)
}

/** Sections shown in the fixed kind order; the stored order is left alone. */
function displaySections(day: Day): Section[] {
  return [...day.sections].sort((a, b) => SECTION_ORDER.indexOf(a.kind) - SECTION_ORDER.indexOf(b.kind))
}

function activeItems(section: Section): Item[] {
  return section.items.filter((i) => !i.retiredFrom)
}

function updateDay(program: Program, dayId: string, fn: (day: Day) => Day): Program {
  return { ...program, days: program.days.map((d) => (d.id === dayId ? fn(d) : d)) }
}

function replaceItem(program: Program, next: Item): Program {
  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      sections: day.sections.map((s) => ({ ...s, items: s.items.map((i) => (i.id === next.id ? next : i)) })),
    })),
  }
}

type Overlay =
  | { kind: 'item'; itemId: string }
  | { kind: 'add'; dayId: string; sectionKind: SectionKind }
  | { kind: 'change'; itemId: string }
  | { kind: 'discard' }
  | null

export function FormsBuilder({
  initial,
  resumed,
  original,
  currentWeek,
  sessions,
  today,
  unit,
  beginnerDefault,
  onSave,
  onExit,
  onDiscarded,
}: {
  initial: BuilderDraft
  /** Resumed from a stored draft: it keeps writing, as before (D-059 rule 4). */
  resumed: boolean
  /** The stored program an edit started from; null for a new one. */
  original: Program | null
  /** Edit mode: the length cannot go below this week (D-042 rule 5). */
  currentWeek: number
  sessions: Session[]
  today: Date
  unit: LoadUnit
  beginnerDefault: boolean
  onSave: (program: Program) => Promise<void>
  onExit: () => void
  onDiscarded: () => void
}) {
  const [program, setProgram] = useState<Program>(initial.program)
  // D-059 rule 4: no draft until the program differs from what was opened.
  const [opened] = useState(() => JSON.stringify(initial.program))
  const [hasDraft, setHasDraft] = useState(resumed)
  const wanted = draftWanted(opened, program, hasDraft)
  if (wanted && !hasDraft) setHasDraft(true)
  const [step, setStep] = useState<DraftStep>(initial.step)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const editing = initial.mode === 'edit'
  const { templates } = useStarterTemplates()
  const library = useLibrary(program, templates)
  const todayIso = toISODate(today)
  const history = useMemo(() => itemsWithHistory(sessions), [sessions])
  const loggedToday = useMemo(() => itemsLoggedOn(sessions, todayIso), [sessions, todayIso])

  // D-042 rule 1: once a draft exists, every change and step is written through.
  useEffect(() => {
    if (saving || !wanted) return
    void writeDraft({ mode: initial.mode, program, step })
  }, [program, step, initial.mode, saving, wanted])

  const days = sortedDays(program)
  const dayDrag = useDragReorder(days.length, (from, to) => setProgram((p) => moveDay(p, from, to)))
  const go = (next: DraftStep) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }
  const title = editing ? program.name || 'Edit program' : 'New program'

  async function save() {
    setSaveError(null)
    setSaving(true)
    try {
      await onSave(finishDraft(program, original))
      await clearDraft()
    } catch (e) {
      setSaving(false)
      setSaveError(`Could not save the program: ${(e as Error).message}`)
    }
  }

  async function discard() {
    setSaving(true)
    await clearDraft()
    onDiscarded()
  }

  const discardLink = (
    <button type="button" className="bd-link bd-link--start" style={{ color: 'var(--danger)', marginTop: 12 }} onClick={() => setOverlay({ kind: 'discard' })}>
      Discard draft
    </button>
  )
  const discardSheet = overlay?.kind === 'discard' && (
    <Sheet
      title="Discard this draft?"
      body={editing ? 'Your changes are not saved. The program stays as it was.' : 'This program has not been saved. Discarding cannot be undone.'}
      onClose={() => setOverlay(null)}
    >
      <button type="button" className="bd-danger" onClick={() => void discard()}>
        Discard draft
      </button>
      <button type="button" className="ob-outline" onClick={() => setOverlay(null)}>
        Keep editing
      </button>
    </Sheet>
  )

  // ── Overlays: picker and item editor ──

  if (overlay?.kind === 'add') {
    const { dayId, sectionKind } = overlay
    return (
      <ExercisePicker
        title={`Add to ${SECTION_TITLE[sectionKind].toLowerCase()}`}
        library={library}
        beginnerDefault={beginnerDefault}
        draft={program}
        onBack={() => setOverlay(null)}
        onPick={(entry) => {
          const id = newId(program, 'item')
          const item = defaultItem(id, entry.id, sectionKind, unit)
          setProgram((p) =>
            updateDay(withExercise(p, entry), dayId, (day) => {
              const existing = day.sections.find((s) => s.kind === sectionKind)
              if (existing) {
                return {
                  ...day,
                  sections: day.sections.map((s) => (s === existing ? { ...s, items: [...s.items, item] } : s)),
                }
              }
              // A new section goes where its kind belongs in the fixed order.
              const section: Section = {
                id: newId(p, `${day.id}-${sectionKind}`),
                kind: sectionKind,
                title: SECTION_TITLE[sectionKind],
                items: [item],
              }
              const at = day.sections.findIndex((s) => SECTION_ORDER.indexOf(s.kind) > SECTION_ORDER.indexOf(sectionKind))
              const sections = [...day.sections]
              sections.splice(at < 0 ? sections.length : at, 0, section)
              return { ...day, sections }
            }),
          )
          setOverlay({ kind: 'item', itemId: id })
        }}
      />
    )
  }

  if (overlay?.kind === 'change') {
    const found = findItem(program, overlay.itemId)
    const current = found ? { id: found.item.exerciseId, exercise: program.exercises[found.item.exerciseId] } : undefined
    return (
      <ExercisePicker
        title={`Swap ${lowerFirst(current?.exercise?.name ?? 'exercise')}`}
        current={current?.exercise ? current : undefined}
        library={library}
        beginnerDefault={beginnerDefault}
        draft={program}
        onBack={() => setOverlay({ kind: 'item', itemId: overlay.itemId })}
        onPick={(entry) => {
          const next = swapExercise(withExercise(program, entry), overlay.itemId, entry.id, history, todayIso, loggedToday)
          // With history the swap adds a new item right after the old one.
          const replacement = history.has(overlay.itemId)
            ? (() => {
                const at = findItem(next, overlay.itemId)
                const items = at ? at.day.sections.flatMap((s) => s.items) : []
                return items[items.findIndex((i) => i.id === overlay.itemId) + 1]?.id ?? overlay.itemId
              })()
            : overlay.itemId
          setProgram(next)
          setOverlay({ kind: 'item', itemId: replacement })
        }}
      />
    )
  }

  if (overlay?.kind === 'item') {
    const found = findItem(program, overlay.itemId)
    if (found) {
      return (
        <ItemEditor
          key={found.item.id + found.item.exerciseId}
          program={program}
          item={found.item}
          hasHistory={history.has(found.item.id)}
          weeksLogged={weeksOfHistory(sessions, found.item.id)}
          onBack={() => setOverlay(null)}
          onSave={(item) => {
            setProgram((p) => replaceItem(p, item))
            setOverlay(null)
          }}
          onRemove={() => {
            setProgram((p) => removeItem(p, found.item.id, history, todayIso, loggedToday))
            setOverlay(null)
          }}
          onChangeExercise={(edited) => {
            setProgram((p) => replaceItem(p, edited))
            setOverlay({ kind: 'change', itemId: edited.id })
          }}
        />
      )
    }
  }

  // ── 2e Settings ──

  if (step === 'settings') {
    const minWeeks = editing ? Math.max(1, currentWeek) : 1
    return (
      <div className="ob">
        <BuilderBar title={title} draft={hasDraft} onBack={onExit} />
        <StepBar current={0} />
        <Hero title="Program settings" />
        <div className="ob-pad" style={{ margin: 0, padding: '0 24px' }}>
          <div className="bd-field">
            <label className="bd-label" htmlFor="program-name">
              Program name
            </label>
            <div className="bd-input">
              <input id="program-name" value={program.name} onChange={(e) => setProgram((p) => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          <div className="bd-field">
            <div className="bd-label">Length</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Stepper
                label="Length in weeks"
                min={minWeeks}
                max={52}
                value={program.programWeeks}
                onChange={(v) => setProgram((p) => ({ ...p, programWeeks: Math.min(52, Math.max(minWeeks, v)) }))}
              />
              <span style={{ fontSize: 16 }}>weeks</span>
            </div>
            {lengthHint(editing, currentWeek, program.programWeeks) && <div className="bd-hint">{lengthHint(editing, currentWeek, program.programWeeks)}</div>}
          </div>
          <div className="bd-field">
            <label className="bd-label" htmlFor="start-date">
              Start date
            </label>
            <div className={editing ? 'bd-input bd-input--readonly' : 'bd-input'}>
              <span>{LONG_DATE.format(parseISODate(program.startDate))}</span>
              {!editing && (
                <input
                  id="start-date"
                  type="date"
                  className="bd-input__overlay"
                  value={program.startDate}
                  onChange={(e) => {
                    if (!e.target.value) return
                    const sunday = toISODate(sundayOnOrBefore(parseISODate(e.target.value)))
                    setProgram((p) => ({ ...p, startDate: sunday }))
                  }}
                />
              )}
            </div>
            <div className="bd-hint">Ends {LONG_DATE.format(endOf(program))}</div>
            {editing && <div className="bd-hint">The start date of the current program can't change.</div>}
          </div>
          {hasDraft && discardLink}
        </div>
        <Dock>
          <PrimaryButton onClick={() => go('days')}>Next: days</PrimaryButton>
        </Dock>
        {discardSheet}
      </div>
    )
  }

  // ── 2f Days ──

  if (step === 'days') {
    const training = days.filter((d) => !d.rest).length
    const firstTraining = days.find((d) => !d.rest) ?? days[0]
    return (
      <div className="ob">
        <BuilderBar title={title} draft={hasDraft} onBack={() => go('settings')} />
        <StepBar current={1} />
        <Hero title="Your week" sub="Tap a day to add exercises." />
        <div className="ob-pad">
          <SectionHead aside={`${training} training · ${days.length - training} rest`}>{days.length} days</SectionHead>
          {days.map((day, i) => (
            <div
              key={day.id}
              data-drag-row
              className={dayDrag.dragging === i ? 'bd-day bd-day--edit ob-rank--dragging' : 'bd-day bd-day--edit'}
              style={{ minHeight: 54 }}
            >
              <span className="ob-rank__handle" style={{ width: 28 }} {...dayDrag.handleProps(i)}>
                <HandleIcon />
              </span>
              <button type="button" className="bd-ex__open" onClick={() => go(`day:${day.id}`)} aria-label={`Edit ${DOW[day.order]} ${day.rest ? 'rest day' : day.name}`}>
                <span className="bd-day__dow">{DOW[day.order]}</span>
                <span className="bd-day__main">
                  <span className={day.rest ? 'bd-day__name bd-day__name--rest' : 'bd-day__name'}>{day.rest ? 'Rest' : day.name}</span>
                </span>
              </button>
              <button type="button" className="ob-rank__move" aria-label={`Move ${DOW[day.order]} up`} disabled={i === 0} onClick={() => setProgram((p) => moveDay(p, i, i - 1))}>
                ↑
              </button>
              <button type="button" className="ob-rank__move" aria-label={`Move ${DOW[day.order]} down`} disabled={i === days.length - 1} onClick={() => setProgram((p) => moveDay(p, i, i + 1))}>
                ↓
              </button>
              <ChevronRight />
            </div>
          ))}
          {hasDraft && discardLink}
        </div>
        <Dock>
          <PrimaryButton onClick={() => go(`day:${firstTraining.id}`)}>Next: exercises</PrimaryButton>
        </Dock>
        {discardSheet}
      </div>
    )
  }

  // ── 2g Day editor ──

  if (step.startsWith('day:')) {
    const day = program.days.find((d) => d.id === step.slice(4)) ?? days[0]
    return (
      <DayEditor
        hasDraft={hasDraft}
        day={day}
        program={program}
        title={`${DOW[day.order]} · ${day.rest ? 'Rest' : day.name}`}
        onBack={() => go('days')}
        onNext={() => go('review')}
        onChange={(fn) => setProgram((p) => fn(p))}
        onOpenItem={(itemId) => setOverlay({ kind: 'item', itemId })}
        onAdd={(sectionKind) => setOverlay({ kind: 'add', dayId: day.id, sectionKind })}
      />
    )
  }

  // ── 2j Review ──

  const checks = reviewChecks(program)
  const training = days.filter((d) => !d.rest).length
  const rest = days.length - training
  return (
    <div className="ob">
      <BuilderBar title={title} draft={hasDraft} onBack={() => go('days')} />
      <StepBar current={3} />
      <Hero
        title={program.name || 'Untitled program'}
        sub={`${SHORT_DATE.format(parseISODate(program.startDate))} – ${SHORT_DATE.format(endOf(program))} · ${training} training ${training === 1 ? 'day' : 'days'} · ${rest} rest ${rest === 1 ? 'day' : 'days'}`}
      />
      <div className="ob-pad">
        <SectionHead>Checks</SectionHead>
        {checks.map((check) => (
          <div className="bd-check" key={check.label}>
            <CheckMark ok={check.ok} />
            <div>
              <div>{check.label}</div>
              {!check.ok && check.detail && <div className="bd-check__detail">{check.detail}</div>}
            </div>
          </div>
        ))}
        <SectionHead>Days</SectionHead>
        {days.map((day) => {
          const count = day.sections.reduce((n, s) => n + activeItems(s).length, 0)
          return (
            <button type="button" className="bd-day bd-day--compact" key={day.id} onClick={() => go(`day:${day.id}`)}>
              <span className="bd-day__dow">{DOW[day.order]}</span>
              <span className="bd-day__main">
                <span className={day.rest ? 'bd-day__name bd-day__name--rest' : 'bd-day__name'}>{day.rest ? 'Rest' : day.name}</span>
              </span>
              {!day.rest && <span className="bd-value">{count} {count === 1 ? 'item' : 'items'}</span>}
            </button>
          )
        })}
        {saveError && <div className="ob-errors" role="alert">{saveError}</div>}
        {hasDraft && discardLink}
      </div>
      <Dock>
        <PrimaryButton disabled={saving || checks.some((c) => !c.ok)} onClick={() => void save()}>
          Save program
        </PrimaryButton>
      </Dock>
      {discardSheet}
    </div>
  )
}

/** Frame 2g, plus the day's own settings (name, focus, rest, swappable) above it. */
function DayEditor({
  day,
  program,
  title,
  hasDraft,
  onBack,
  onNext,
  onChange,
  onOpenItem,
  onAdd,
}: {
  day: Day
  program: Program
  title: string
  /** Show the Draft pill only once a draft exists (D-059 rule 4). */
  hasDraft: boolean
  onBack: () => void
  onNext: () => void
  onChange: (fn: (p: Program) => Program) => void
  onOpenItem: (itemId: string) => void
  onAdd: (kind: SectionKind) => void
}) {
  const sections = displaySections(day).filter((s) => activeItems(s).length > 0)
  const missing = SECTION_ORDER.filter((kind) => !sections.some((s) => s.kind === kind))
  const setDay = (patch: (d: Day) => Day) => onChange((p) => updateDay(p, day.id, patch))

  return (
    <div className="ob">
      <BuilderBar title={title} draft={hasDraft} onBack={onBack} />
      <StepBar current={2} />
      <div className="bd-day-settings">
        <div className="bd-cols">
          <div className="bd-field" style={{ marginTop: 10 }}>
            <label className="bd-label" htmlFor="day-name">
              Day name
            </label>
            <div className="bd-input">
              <input id="day-name" value={day.name} onChange={(e) => setDay((d) => ({ ...d, name: e.target.value }))} />
            </div>
          </div>
          <div className="bd-field" style={{ marginTop: 10 }}>
            <label className="bd-label" htmlFor="day-focus">
              Focus
            </label>
            <div className="bd-input">
              <input
                id="day-focus"
                placeholder="Optional"
                value={day.focus ?? ''}
                onChange={(e) =>
                  setDay((d) => {
                    const next = { ...d }
                    if (e.target.value.trim() === '') delete next.focus
                    else next.focus = e.target.value
                    return next
                  })
                }
              />
            </div>
          </div>
        </div>
        <div className="bd-field" style={{ marginTop: 12 }}>
          <Segmented
            label="Training or rest"
            options={[
              { value: 'training', label: 'Training' },
              { value: 'rest', label: 'Rest' },
            ]}
            value={day.rest ? 'rest' : 'training'}
            onChange={(v) =>
              setDay((d) => {
                const next = { ...d }
                if (v === 'rest') next.rest = true
                else delete next.rest
                return next
              })
            }
          />
        </div>
      </div>

      <div className="ob-pad">
        {sections.map((section) => (
          <SectionItems key={section.id} section={section} program={program} onChange={onChange} dayId={day.id} onOpenItem={onOpenItem} onAdd={() => onAdd(section.kind)} />
        ))}
        {missing.length > 0 && (
          <div className="bd-chips" style={{ marginTop: 10 }}>
            {missing.map((kind) => (
              <button type="button" className="bd-chip" key={kind} onClick={() => onAdd(kind)}>
                + {SECTION_TITLE[kind]}
              </button>
            ))}
          </div>
        )}
      </div>
      <Dock>
        <PrimaryButton onClick={onNext}>Next: review</PrimaryButton>
      </Dock>
    </div>
  )
}

function SectionItems({
  section,
  program,
  dayId,
  onChange,
  onOpenItem,
  onAdd,
}: {
  section: Section
  program: Program
  dayId: string
  onChange: (fn: (p: Program) => Program) => void
  onOpenItem: (itemId: string) => void
  onAdd: () => void
}) {
  const items = activeItems(section)
  const main = section.kind === 'main' || section.kind === 'block' || section.kind === 'abs'
  // Reordering moves active items among themselves; retired ones keep their slots.
  const move = (from: number, to: number) =>
    onChange((p) =>
      updateDay(p, dayId, (d) => ({
        ...d,
        sections: d.sections.map((s) => {
          if (s.id !== section.id) return s
          const active = s.items.filter((i) => !i.retiredFrom)
          if (to < 0 || to >= active.length) return s
          const [moved] = active.splice(from, 1)
          active.splice(to, 0, moved)
          let k = 0
          return { ...s, items: s.items.map((i) => (i.retiredFrom ? i : active[k++])) }
        }),
      })),
    )
  const drag = useDragReorder(items.length, move)

  return (
    <>
      <SectionHead aside={String(items.length)}>{section.title}</SectionHead>
      {items.map((item, i) => {
        const name = program.exercises[item.exerciseId]?.name ?? item.exerciseId
        return (
          <div key={item.id} data-drag-row className={drag.dragging === i ? 'bd-simple ob-rank--dragging' : main ? 'bd-simple bd-simple--main' : 'bd-simple'}>
            <span className="ob-rank__handle" style={{ width: 28 }} {...drag.handleProps(i)}>
              <HandleIcon />
            </span>
            <button type="button" className="bd-ex__open" style={{ gap: 12 }} onClick={() => onOpenItem(item.id)}>
              <span className="bd-simple__name">{name}</span>
              <span className="bd-value">{prescriptionText(item)}</span>
            </button>
            <button type="button" className="ob-rank__move" aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
              ↑
            </button>
            <button type="button" className="ob-rank__move" aria-label={`Move ${name} down`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
              ↓
            </button>
            {main && <ChevronRight />}
          </div>
        )
      })}
      <button type="button" className="ob-add" style={{ minHeight: 44 }} onClick={onAdd}>
        <span>+</span>Add to {section.title.toLowerCase()}
      </button>
    </>
  )
}
