// The starter path, frames 2a and 2b (EXEC-08 task 6). Changes live only in
// this component's state until "Use this program" hands the program back.

import { useState } from 'react'

import {
  SECTION_ORDER,
  defaultItem,
  lowerFirst,
  newId,
  sessionGroup,
  sessionMinutes,
  swapInGroup,
  weekdaysLabel,
  withExercise,
  type LibraryEntry,
} from '../lib/builder.ts'
import { longestSessionMin, trainingDays } from '../lib/onboarding.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { Dock, PrimaryButton, SectionHead } from '../onboarding/ui.tsx'
import type { Day, Item, LoadUnit, Program, SectionKind } from '../types/program.ts'
import { ExerciseDetail, ExercisePicker } from './ExercisePicker.tsx'
import { AppbarAction, BuilderBar, ChevronRight, Demo, Hero, Note, SwapArrows } from './ui.tsx'
import type { LoadedTemplate } from './useLibrary.ts'
import { useLibrary } from './useLibrary.ts'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Kinds listed plainly, without a demo or Swap (frame 2b's warm-up). */
const PLAIN: SectionKind[] = ['warmup', 'cooldown', 'daily']

function exerciseCount(day: Day): number {
  return day.sections.filter((s) => !PLAIN.includes(s.kind)).reduce((n, s) => n + s.items.length, 0)
}


type View =
  | { kind: 'week' }
  | { kind: 'day'; dayId: string }
  | { kind: 'swap'; dayId: string; itemId: string }
  | { kind: 'add'; dayId: string }
  | { kind: 'detail'; dayId: string; entry: LibraryEntry }

export function StarterReview({
  template,
  level,
  templates,
  beginnerDefault,
  unit,
  onUse,
  onBack,
}: {
  template: Program
  level: string
  templates: LoadedTemplate[] | null
  beginnerDefault: boolean
  unit: LoadUnit
  onUse: (program: Program) => void
  onBack: () => void
}) {
  const [program, setProgram] = useState<Program>(template)
  const [view, setView] = useState<View>({ kind: 'week' })
  const library = useLibrary(program, templates)
  const changed = program !== template

  if (view.kind === 'detail') {
    return <ExerciseDetail entry={view.entry} onBack={() => setView({ kind: 'day', dayId: view.dayId })} />
  }

  if (view.kind === 'swap' || view.kind === 'add') {
    const day = program.days.find((d) => d.id === view.dayId)!
    const group = sessionGroup(program, day.id)
    const item = view.kind === 'swap' ? day.sections.flatMap((s) => s.items).find((i) => i.id === view.itemId) : undefined
    const current = item ? { id: item.exerciseId, exercise: program.exercises[item.exerciseId] } : undefined
    const back = () => setView({ kind: 'day', dayId: view.dayId })
    return (
      <ExercisePicker
        title={current ? `Swap ${lowerFirst(current.exercise.name)}` : 'Add exercise'}
        current={current}
        library={library}
        beginnerDefault={beginnerDefault}
        draft={program}
        onBack={back}
        onPick={(entry) => {
          if (item) {
            setProgram(swapInGroup(program, day.id, item.id, entry))
            back()
            return
          }
          // Add: a new item at the end of Main on every day of the session.
          let next = withExercise(program, entry)
          for (const d of group) {
            const id = newId(next, 'item')
            const added: Item = defaultItem(id, entry.id, 'main', unit)
            next = {
              ...next,
              days: next.days.map((x) => {
                if (x.id !== d.id) return x
                const main = x.sections.find((s) => s.kind === 'main')
                if (main) return { ...x, sections: x.sections.map((s) => (s === main ? { ...s, items: [...s.items, added] } : s)) }
                return { ...x, sections: [...x.sections, { id: newId(next, `${x.id}-main`), kind: 'main' as const, title: 'Main', items: [added] }] }
              }),
            }
          }
          setProgram(next)
          back()
        }}
      />
    )
  }

  // ── 2b One template day ──
  if (view.kind === 'day') {
    const day = program.days.find((d) => d.id === view.dayId)!
    const group = sessionGroup(program, day.id)
    const sections = [...day.sections].sort((a, b) => SECTION_ORDER.indexOf(a.kind) - SECTION_ORDER.indexOf(b.kind))
    const open = (exerciseId: string) =>
      setView({ kind: 'detail', dayId: day.id, entry: { id: exerciseId, exercise: program.exercises[exerciseId] } })
    return (
      <div className="ob" style={{ paddingBottom: 40 }}>
        <BuilderBar
          title={day.name}
          draft={changed}
          onBack={() => setView({ kind: 'week' })}
          right={<AppbarAction onClick={() => setView({ kind: 'week' })}>Done</AppbarAction>}
        />
        <Hero title={day.name} sub={`${weekdaysLabel(group)} · about ${sessionMinutes(day)} min`} />
        <Note>Tap an exercise to see how it’s done. Swap anything that doesn’t suit you.</Note>
        <div className="ob-pad">
          {sections.map((section) => (
            <div key={section.id}>
              <SectionHead aside={String(section.items.length)}>{section.title}</SectionHead>
              {section.items.map((item) => {
                const name = program.exercises[item.exerciseId]?.name ?? item.exerciseId
                if (PLAIN.includes(section.kind)) {
                  return (
                    <button type="button" className="bd-simple" key={item.id} onClick={() => open(item.exerciseId)}>
                      <span className="bd-simple__name">{name}</span>
                      <span className="bd-value">{prescriptionText(item)}</span>
                    </button>
                  )
                }
                return (
                  <div className="bd-ex" key={item.id}>
                    <button type="button" className="bd-ex__open" onClick={() => open(item.exerciseId)}>
                      <Demo />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="bd-ex__name">{name}</div>
                        <div className="bd-ex__sub">{prescriptionText(item)}</div>
                      </div>
                    </button>
                    <button type="button" className="bd-swap" aria-label={`Swap ${name}`} onClick={() => setView({ kind: 'swap', dayId: day.id, itemId: item.id })}>
                      <SwapArrows />
                      Swap
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
          <button type="button" className="ob-add" onClick={() => setView({ kind: 'add', dayId: day.id })}>
            <span>+</span>Add exercise
          </button>
        </div>
      </div>
    )
  }

  // ── 2a The week ──
  const days = [...program.days].sort((a, b) => a.order - b.order)
  const training = trainingDays(program)
  const minutes = longestSessionMin(program)
  const firstTraining = days.find((d) => !d.rest)
  return (
    <div className="ob" style={{ paddingBottom: 170 }}>
      <BuilderBar title="Starter program" draft={changed} onBack={onBack} />
      <Hero
        title={program.name}
        sub={[`${training} days a week`, minutes !== null ? `about ${minutes} min` : null, level, `${program.programWeeks} weeks`].filter(Boolean).join(' · ')}
      />
      <div className="ob-pad">
        <SectionHead aside={`${training} training days`}>Your week</SectionHead>
        {days.map((day) =>
          day.rest ? (
            <div className="bd-day bd-day--rest" key={day.id}>
              <span className="bd-day__dow">{DOW[day.order]}</span>
              <span className="bd-day__main">
                <span className="bd-day__name bd-day__name--rest">Rest</span>
              </span>
            </div>
          ) : (
            <button type="button" className="bd-day" key={day.id} onClick={() => setView({ kind: 'day', dayId: day.id })}>
              <span className="bd-day__dow">{DOW[day.order]}</span>
              <span className="bd-day__main">
                <div className="bd-day__name">{day.name}</div>
                <div className="bd-day__sub">{exerciseCount(day)} exercises</div>
              </span>
              <ChevronRight />
            </button>
          ),
        )}
      </div>
      <Note>Weights start empty. On your first session you pick a weight that feels manageable, and the app remembers it.</Note>
      <Dock>
        <PrimaryButton onClick={() => onUse(program)}>Use this program</PrimaryButton>
        <button
          type="button"
          className="ob-outline"
          disabled={!firstTraining}
          onClick={() => firstTraining && setView({ kind: 'day', dayId: firstTraining.id })}
        >
          Change something first
        </button>
      </Dock>
    </div>
  )
}
