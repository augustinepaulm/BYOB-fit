// Frames 2c (swap picker) and 2d (exercise detail), plus Create an exercise
// (EXEC-08 task 7). The picker never writes; it hands the choice back.

import { useState } from 'react'

import {
  EQUIPMENT,
  LEVELS,
  MUSCLES,
  equipmentLabel,
  exerciseMeta,
  filterLibrary,
  howToSteps,
  lowerFirst,
  muscleLabel,
  newId,
  type LibraryEntry,
} from '../lib/builder.ts'
import { Dock, PrimaryButton, SectionHead, TickIcon } from '../onboarding/ui.tsx'
import type { Equipment, Exercise, ExerciseLevel, Muscle, Program } from '../types/program.ts'
import { AppbarAction, BuilderBar, Chip, Demo, SearchGlyph } from './ui.tsx'

/** Frame 2d: demo slot, name, metadata and the how-to as numbered steps. */
export function ExerciseDetail({
  entry,
  onBack,
  onUse,
}: {
  entry: LibraryEntry
  onBack: () => void
  onUse?: () => void
}) {
  const { exercise } = entry
  const steps = howToSteps(exercise.howTo)
  return (
    <div className="ob" style={onUse ? undefined : { paddingBottom: 40 }}>
      <BuilderBar title={exercise.name} onBack={onBack} />
      <div className="bd-demo-hero" aria-hidden="true">
        <span>demo · looping clip</span>
      </div>
      <div style={{ padding: '18px 24px 0' }}>
        <h1 className="ob-title" style={{ marginTop: 0 }}>
          {exercise.name}
        </h1>
        {exerciseMeta(exercise) && <div className="bd-hero__sub" style={{ marginTop: 6 }}>{exerciseMeta(exercise)}</div>}
      </div>
      <div className="ob-pad">
        <SectionHead>How to do it</SectionHead>
        {steps.length === 0 && <div className="bd-hint">No how-to yet.</div>}
        {steps.map((step, i) => (
          <div className="ob-numbered" key={i} style={{ gap: 12 }}>
            <span style={{ fontWeight: 700, color: 'var(--secondary)', width: 16, flex: 'none' }}>{i + 1}</span>
            <span style={{ fontSize: 15, lineHeight: 1.45 }}>{step}</span>
          </div>
        ))}
      </div>
      {onUse && (
        <Dock>
          <PrimaryButton onClick={onUse}>Use {lowerFirst(exercise.name)}</PrimaryButton>
        </Dock>
      )}
    </div>
  )
}

function CreateExercise({
  draft,
  onBack,
  onCreate,
}: {
  draft: Program
  onBack: () => void
  onCreate: (entry: LibraryEntry) => void
}) {
  const [name, setName] = useState('')
  const [howTo, setHowTo] = useState('')
  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [equipment, setEquipment] = useState<Equipment | undefined>()
  const [level, setLevel] = useState<ExerciseLevel | undefined>()
  const [touched, setTouched] = useState(false)
  const nameError = touched && name.trim() === '' ? 'A name is required' : null

  function create() {
    setTouched(true)
    if (name.trim() === '') return
    const exercise: Exercise = { name: name.trim(), howTo: howTo.trim() }
    if (muscles.length) exercise.muscles = muscles
    if (equipment) exercise.equipment = equipment
    if (level) exercise.level = level
    onCreate({ id: newId(draft, 'custom'), exercise })
  }

  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <BuilderBar title="Create an exercise" onBack={onBack} right={<AppbarAction onClick={create}>Save</AppbarAction>} />
      <div className="ob-pad">
        <div className="bd-field">
          <label className={nameError ? 'bd-label bd-label--error' : 'bd-label'} htmlFor="ex-name">
            Name
          </label>
          <div className={nameError ? 'bd-input bd-input--error' : 'bd-input'}>
            <input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} />
          </div>
          {nameError && <div className="bd-error">{nameError}</div>}
        </div>
        <div className="bd-field">
          <label className="bd-label" htmlFor="ex-howto">
            How to do it <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <div className="bd-input">
            <textarea id="ex-howto" value={howTo} onChange={(e) => setHowTo(e.target.value)} />
          </div>
        </div>
        <div className="bd-field">
          <div className="bd-label">Muscles (optional)</div>
          <div className="bd-chips">
            {MUSCLES.map((m) => (
              <Chip key={m} on={muscles.includes(m)} onClick={() => setMuscles((all) => (all.includes(m) ? all.filter((x) => x !== m) : [...all, m]))}>
                {muscleLabel(m)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="bd-field">
          <div className="bd-label">Equipment (optional)</div>
          <div className="bd-chips">
            {EQUIPMENT.map((e) => (
              <Chip key={e} on={equipment === e} onClick={() => setEquipment((cur) => (cur === e ? undefined : e))}>
                {equipmentLabel(e)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="bd-field">
          <div className="bd-label">Level (optional)</div>
          <div className="bd-chips">
            {LEVELS.map((l) => (
              <Chip key={l} on={level === l} onClick={() => setLevel((cur) => (cur === l ? undefined : l))}>
                {l}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Frame 2c. Same muscles starts on when the current exercise has muscles;
 * Beginner friendly starts on for New (onboarding) users.
 */
export function ExercisePicker({
  title,
  current,
  library,
  beginnerDefault,
  draft,
  onPick,
  onBack,
  allowCreate = true,
}: {
  title: string
  /** False where a new exercise could not be kept, e.g. a session-only swap. */
  allowCreate?: boolean
  current?: LibraryEntry
  library: LibraryEntry[]
  beginnerDefault: boolean
  draft: Program
  onPick: (entry: LibraryEntry) => void
  onBack: () => void
}) {
  const muscles = current?.exercise.muscles
  const [query, setQuery] = useState('')
  const [same, setSame] = useState(Boolean(muscles?.length))
  const [beginner, setBeginner] = useState(beginnerDefault)
  const [noEquipment, setNoEquipment] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<LibraryEntry | null>(null)
  const [creating, setCreating] = useState(false)

  if (creating) return <CreateExercise draft={draft} onBack={() => setCreating(false)} onCreate={onPick} />
  if (detail) {
    return <ExerciseDetail entry={detail} onBack={() => setDetail(null)} onUse={() => onPick(detail)} />
  }

  const results = filterLibrary(
    library.filter((e) => e.id !== current?.id),
    { sameMusclesAs: same ? muscles : undefined, beginner, noEquipment, query },
  )
  const chosen = results.find((e) => e.id === selected) ?? null

  return (
    <div className="ob" style={{ paddingBottom: 170 }}>
      <BuilderBar title={title} onBack={onBack} />
      <label className="bd-search">
        <SearchGlyph />
        <input
          type="search"
          placeholder="Search exercises"
          aria-label="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="bd-chips bd-chips--pad">
        {muscles?.length ? (
          <Chip on={same} onClick={() => setSame((v) => !v)}>
            Same muscles
          </Chip>
        ) : null}
        <Chip on={beginner} onClick={() => setBeginner((v) => !v)}>
          Beginner friendly
        </Chip>
        <Chip on={noEquipment} onClick={() => setNoEquipment((v) => !v)}>
          No equipment
        </Chip>
      </div>
      <div style={{ margin: '8px 24px 0' }} role="radiogroup" aria-label="Exercises">
        {results.map((entry) => {
          const on = entry.id === selected
          return (
            <div className="bd-ex bd-ex--pick" key={entry.id}>
              <button type="button" className="bd-ex__open" role="radio" aria-checked={on} onClick={() => setSelected(entry.id)}>
                <Demo large />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bd-ex__name">{entry.exercise.name}</div>
                  {exerciseMeta(entry.exercise) && <div className="bd-ex__sub">{exerciseMeta(entry.exercise)}</div>}
                </div>
                <span className={on ? 'ob-mark ob-mark--on' : 'ob-mark'}>{on && <TickIcon />}</span>
              </button>
            </div>
          )
        })}
        {results.length === 0 && (
          <div className="bd-hint" style={{ padding: '16px 0' }}>
            No exercises match. Turn a filter off, or create one.
          </div>
        )}
        {allowCreate && (
          <button type="button" className="ob-add" onClick={() => setCreating(true)}>
            <span>+</span>Create an exercise
          </button>
        )}
      </div>
      <Dock>
        <PrimaryButton disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
          {chosen ? `Use ${lowerFirst(chosen.exercise.name)}` : 'Choose an exercise'}
        </PrimaryButton>
        {chosen && (
          <button type="button" className="bd-link" onClick={() => setDetail(chosen)}>
            See how {lowerFirst(chosen.exercise.name)} is done
          </button>
        )}
      </Dock>
    </div>
  )
}
