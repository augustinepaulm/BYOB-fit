// Goal setter, frame 5a (EXEC-07 task 6, D-030): the onboarding goal parts on
// one scrolling screen, saved with Save.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getGoals, saveGoals } from '../db/index.ts'
import { toISODate } from '../lib/dates.ts'
import {
  fromGoals,
  goalSummary,
  goalsValid,
  statsFromInput,
  toGoals,
  type GoalDraft,
  type Timeframe,
} from '../lib/goals.ts'
import { loadRepsExercises } from '../lib/onboarding.ts'
import { useProgram } from '../program/useProgram.ts'
import { unitsOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import {
  CurrentStats,
  GoalBox,
  GoalPicker,
  GoalRanking,
  GoalTargets,
  TimeframePicker,
  type StatsDraft,
} from '../onboarding/goalParts.tsx'
import { BackIcon, SectionHead } from '../onboarding/ui.tsx'
import type { Goals } from '../types/stores.ts'

export function GoalScreen() {
  const navigate = useNavigate()
  const { program, today } = useProgram()
  const { settings, loading: settingsLoading } = useSettings()
  const [stored, setStored] = useState<Goals | null | undefined>(undefined)
  const [goals, setGoals] = useState<GoalDraft[]>([])
  const [weeks, setWeeks] = useState<Timeframe>(12)
  const [stats, setStats] = useState<StatsDraft>({ weight: '', bodyFat: '' })
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void getGoals().then((found) => {
      if (!live) return
      setStored(found ?? null)
      if (found) {
        setGoals(fromGoals(found))
        setWeeks(found.timeframeWeeks)
        setStats({
          weight: found.currentStats?.weight !== undefined ? String(found.currentStats.weight) : '',
          bodyFat:
            found.currentStats?.bodyFatPct !== undefined ? String(found.currentStats.bodyFatPct) : '',
        })
      } else {
        setPicking(true)
      }
    })
    return () => {
      live = false
    }
  }, [])

  const exercises = useMemo(() => (program ? loadRepsExercises(program) : []), [program])
  const exerciseName = (id: string) =>
    exercises.find((e) => e.id === id)?.name ?? program?.exercises[id]?.name

  if (stored === undefined || settingsLoading) return null

  const unit = unitsOf(settings)
  const summary = goalSummary(goals, weeks, exerciseName)

  async function save() {
    setError(null)
    try {
      await saveGoals(
        toGoals(goals, {
          timeframeWeeks: weeks,
          // Editing keeps the original start; a first goal starts today.
          startDate: stored?.startDate ?? toISODate(today),
          currentStats: statsFromInput(stats.weight, stats.bodyFat, unit),
          now: new Date(),
        }),
      )
      navigate('/profile', { replace: true })
    } catch (e) {
      setError(`Could not save the goal: ${(e as Error).message}`)
    }
  }

  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <div className="ob-appbar">
        <button type="button" className="ob-appbar__back" aria-label="Back" onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        <div className="ob-appbar__title">Goal</div>
        <button
          type="button"
          className="ob-appbar__save"
          disabled={!goalsValid(goals)}
          onClick={() => void save()}
        >
          Save
        </button>
      </div>

      {summary && (
        <div style={{ marginTop: -12 }}>
          <GoalBox summary={summary} />
        </div>
      )}

      <div className="ob-pad">
        <SectionHead>Goals, in order</SectionHead>
        <GoalRanking goals={goals} exerciseName={exerciseName} onChange={setGoals} />
        <button type="button" className="ob-add" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
          <span>{picking ? '−' : '+'}</span>
          {picking ? 'Done choosing' : 'Add a goal'}
        </button>
        {picking && <GoalPicker goals={goals} unit={unit} onChange={setGoals} />}

        <GoalTargets goals={goals} exercises={exercises} onChange={setGoals} />

        <TimeframePicker
          heading="Timeframe, in weeks"
          weeks={weeks}
          start={stored ? new Date(`${stored.startDate}T00:00:00`) : today}
          showEnd={false}
          onChange={setWeeks}
        />
      </div>

      <CurrentStats stats={stats} unit={unit} onChange={setStats} />

      {error && (
        <div className="ob-pad ob-errors" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
