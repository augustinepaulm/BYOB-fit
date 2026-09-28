// Goal components shared by onboarding (1f to 1h) and the goal setter (5a).

import { useRef, useState, type PointerEvent } from 'react'

import {
  GOAL_TYPES,
  MAX_GOALS,
  TIMEFRAMES,
  goalDetail,
  goalLabel,
  moveGoal,
  rankBadge,
  targetKind,
  timeframeLine,
  toggleGoal,
  type GoalDraft,
  type Timeframe,
} from '../lib/goals.ts'
import type { LoadUnit } from '../types/program.ts'
import {
  ChevronDown,
  ChoiceRow,
  HandleIcon,
  LockIcon,
  SectionHead,
  Segmented,
  Stepper,
} from './ui.tsx'

export interface ExerciseOption {
  id: string
  name: string
}

/** Frame 1f: six goals, the first chosen is Main, up to three in all. */
export function GoalPicker({
  goals,
  onChange,
  unit,
}: {
  goals: GoalDraft[]
  onChange: (goals: GoalDraft[]) => void
  unit: LoadUnit
}) {
  return (
    <div role="group" aria-label="Goals">
      {GOAL_TYPES.map(({ type, label }) => {
        const at = goals.findIndex((g) => g.type === type)
        const on = at >= 0
        return (
          <ChoiceRow
            key={type}
            shape="check"
            title={label}
            badge={on ? rankBadge(at) : undefined}
            on={on}
            disabled={!on && goals.length >= MAX_GOALS}
            onClick={() => onChange(toggleGoal(goals, type, unit))}
          />
        )
      })}
    </div>
  )
}

function UnitToggle({ value, onChange }: { value: LoadUnit; onChange: (unit: LoadUnit) => void }) {
  return (
    <div className="ob-units" role="radiogroup" aria-label="Unit">
      {(['lb', 'kg'] as const).map((unit) => (
        <button
          key={unit}
          type="button"
          role="radio"
          aria-checked={value === unit}
          className={value === unit ? 'ob-unit ob-unit--on' : 'ob-unit'}
          onClick={() => onChange(unit)}
        >
          {unit}
        </button>
      ))}
    </div>
  )
}

/** Frame 1g: a target for each goal that takes a number. */
export function GoalTargets({
  goals,
  onChange,
  exercises,
}: {
  goals: GoalDraft[]
  onChange: (goals: GoalDraft[]) => void
  exercises: ExerciseOption[]
}) {
  function update(index: number, patch: Partial<GoalDraft>) {
    onChange(goals.map((g, i) => (i === index ? { ...g, ...patch } : g)))
  }
  return (
    <>
      {goals.map((goal, i) => {
        const kind = targetKind(goal.type)
        if (kind === null) return null
        const amount = goal.amount ?? (kind === 'percent' ? 5 : 10)
        const label = goalLabel(goal.type)
        return (
          <div key={goal.type}>
            <SectionHead aside={rankBadge(i)}>{label}</SectionHead>
            {kind === 'weight' && (
              <div className="ob-target">
                <span className="ob-target__verb">Lose</span>
                <Stepper label={`${label} amount`} value={amount} onChange={(v) => update(i, { amount: v })} />
                <UnitToggle value={goal.unit ?? 'kg'} onChange={(unit) => update(i, { unit })} />
              </div>
            )}
            {kind === 'percent' && (
              <div className="ob-target">
                <span className="ob-target__verb">Lose</span>
                <Stepper label={`${label} amount`} value={amount} onChange={(v) => update(i, { amount: v })} />
                <span>%</span>
              </div>
            )}
            {kind === 'strength' && (
              <>
                <div className="ob-target ob-target--open">
                  <span className="ob-target__verb">Add</span>
                  <Stepper label={`${label} amount`} value={amount} onChange={(v) => update(i, { amount: v })} />
                  <UnitToggle value={goal.unit ?? 'kg'} onChange={(unit) => update(i, { unit })} />
                  <span>to</span>
                </div>
                <div className="ob-select">
                  <select
                    aria-label="Exercise"
                    value={goal.exerciseId ?? ''}
                    onChange={(event) =>
                      update(i, { exerciseId: event.target.value || undefined })
                    }
                  >
                    <option value="">
                      {exercises.length ? 'Choose an exercise' : 'No program exercises yet'}
                    </option>
                    {exercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
              </>
            )}
          </div>
        )
      })}
    </>
  )
}

/** 4, 8, 12 or 16 weeks, with the end date under it (1g) or without (5a). */
export function TimeframePicker({
  weeks,
  onChange,
  start,
  heading,
  showEnd,
}: {
  weeks: Timeframe
  onChange: (weeks: Timeframe) => void
  start: Date
  heading: string
  showEnd: boolean
}) {
  return (
    <>
      <div style={{ marginTop: 28 }}>
        <SectionHead>{heading}</SectionHead>
      </div>
      <div style={{ marginTop: 12 }}>
        <Segmented
          label={heading}
          options={TIMEFRAMES.map((n) => ({ value: n, label: String(n) }))}
          value={weeks}
          onChange={onChange}
        />
      </div>
      {showEnd && <div className="ob-note">{timeframeLine(start, weeks)}</div>}
    </>
  )
}

/**
 * Frame 1h: goals in rank order. Drag the handle to reorder; Move up and Move
 * down do the same for anyone who cannot drag.
 */
export function GoalRanking({
  goals,
  onChange,
  exerciseName,
}: {
  goals: GoalDraft[]
  onChange: (goals: GoalDraft[]) => void
  exerciseName: (id: string) => string | undefined
}) {
  const drag = useRef<{ index: number; startY: number; rowHeight: number } | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  function onPointerDown(event: PointerEvent<HTMLDivElement>, index: number) {
    const row = event.currentTarget.closest('.ob-rank') as HTMLElement | null
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { index, startY: event.clientY, rowHeight: row?.offsetHeight ?? 60 }
    setDragging(index)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state) return
    const steps = Math.trunc((event.clientY - state.startY) / state.rowHeight)
    if (steps === 0) return
    const to = Math.max(0, Math.min(goals.length - 1, state.index + steps))
    if (to === state.index) return
    onChange(moveGoal(goals, state.index, to))
    drag.current = {
      ...state,
      index: to,
      startY: state.startY + (to - state.index) * state.rowHeight,
    }
    setDragging(to)
  }

  function onPointerEnd() {
    drag.current = null
    setDragging(null)
  }

  return (
    <div>
      {goals.map((goal, i) => {
        const detail = goalDetail(goal, goal.exerciseId ? exerciseName(goal.exerciseId) : undefined)
        return (
          <div key={goal.type} className={dragging === i ? 'ob-rank ob-rank--dragging' : 'ob-rank'}>
            <span className="ob-rank__n">{i + 1}</span>
            <div className="ob-rank__main">
              <div className="ob-rank__title">{goalLabel(goal.type)}</div>
              {detail && <div className="ob-rank__sub">{detail}</div>}
            </div>
            <button
              type="button"
              className="ob-rank__move"
              aria-label={`Move ${goalLabel(goal.type)} up`}
              disabled={i === 0}
              onClick={() => onChange(moveGoal(goals, i, i - 1))}
            >
              ↑
            </button>
            <button
              type="button"
              className="ob-rank__move"
              aria-label={`Move ${goalLabel(goal.type)} down`}
              disabled={i === goals.length - 1}
              onClick={() => onChange(moveGoal(goals, i, i + 1))}
            >
              ↓
            </button>
            <div
              className="ob-rank__handle"
              aria-hidden="true"
              onPointerDown={(event) => onPointerDown(event, i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            >
              <HandleIcon />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function GoalBox({ summary }: { summary: string }) {
  return (
    <div className="ob-goalbox">
      <div className="ob-goalbox__label">Your goal</div>
      <div className="ob-goalbox__text">{summary}</div>
    </div>
  )
}

export interface StatsDraft {
  weight: string
  bodyFat: string
}

/** Current weight and body fat: optional, kept on the phone (D-030). */
export function CurrentStats({
  stats,
  onChange,
  unit,
}: {
  stats: StatsDraft
  onChange: (stats: StatsDraft) => void
  unit: LoadUnit
}) {
  return (
    <div className="ob-stats">
      <div className="ob-stats__title">
        Current stats <span>(optional)</span>
      </div>
      <div className="ob-stats__row">
        <div className="ob-stats__cell">
          <label className="ob-stats__label" htmlFor="stat-weight">
            Weight
          </label>
          <div className="ob-field">
            <input
              id="stat-weight"
              inputMode="decimal"
              placeholder="Optional"
              value={stats.weight}
              onChange={(event) => onChange({ ...stats, weight: event.target.value })}
            />
            <span className="ob-field__unit">{unit}</span>
          </div>
        </div>
        <div className="ob-stats__cell">
          <label className="ob-stats__label" htmlFor="stat-fat">
            Body fat
          </label>
          <div className="ob-field">
            <input
              id="stat-fat"
              inputMode="decimal"
              placeholder="Optional"
              value={stats.bodyFat}
              onChange={(event) => onChange({ ...stats, bodyFat: event.target.value })}
            />
            <span className="ob-field__unit">%</span>
          </div>
        </div>
      </div>
      <div className="ob-lock">
        <LockIcon />
        <span>Stored on this phone. Never sent to AI unless you allow it.</span>
      </div>
    </div>
  )
}
