// First run, frames 1a to 1l (EXEC-07 task 5, D-029, D-030, D-031, D-037).
// Every answer lives in wizard state and survives Back; nothing is stored
// until Go to Today on the summary step.

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import {
  getSettings,
  listPrograms,
  saveGoals,
  saveProgram,
  saveSettings,
  setActiveProgram,
} from '../db/index.ts'
import { toISODate } from '../lib/dates.ts'
import {
  goalSummary,
  goalsValid,
  statsFromInput,
  toGoals,
  unitFromGoals,
  type GoalDraft,
  type Timeframe,
} from '../lib/goals.ts'
import { importProgramText } from '../lib/importProgram.ts'
import {
  STARTER_TEMPLATES,
  applyUnit,
  loadRepsExercises,
  longestSessionMin,
  prepareTemplate,
  suggestedTemplate,
  trainingDays,
  uniqueProgramId,
  type Experience,
} from '../lib/onboarding.ts'
import { recordStoragePersistence } from '../lib/storage.ts'
import { AIIntroStep, AIKeyStep } from '../onboarding/AISteps.tsx'
import { BuilderEntry } from '../builder/BuilderEntry.tsx'
import { StarterReview } from '../builder/StarterReview.tsx'
import { useProgram } from '../program/useProgram.ts'
import {
  CurrentStats,
  GoalBox,
  GoalPicker,
  GoalRanking,
  GoalTargets,
  TimeframePicker,
  type StatsDraft,
} from '../onboarding/goalParts.tsx'
import {
  ChoiceRow,
  Dock,
  LockIcon,
  PrimaryButton,
  Segmented,
  StepHead,
  StepNav,
} from '../onboarding/ui.tsx'
import type { LoadUnit, Program } from '../types/program.ts'
import type { PrivacyLevel } from '../types/stores.ts'

type Step = '1a' | '1b' | '1c' | '1d' | 'forms' | '1e' | '2a' | '1f' | '1g' | '1h' | '1i' | '1j' | '1k' | '1l'

const STEP_NUMBER: Record<Step, number> = {
  '1a': 1, '1b': 2, '1c': 3, '1d': 4, forms: 4, '1e': 4, '2a': 4, '1f': 5,
  '1g': 5, '1h': 5, '1i': 6, '1j': 7, '1k': 7, '1l': 8,
}

type ProgramChoice =
  | { kind: 'template'; file: string; program: Program }
  | { kind: 'import'; program: Program }
  | { kind: 'built'; program: Program }
  | null

interface Answers {
  followsProgram?: boolean
  experience?: Experience
  safetyAckAt?: string
  /** undefined: not reached yet; null: skipped. */
  program?: ProgramChoice
  templateFile?: string
  goals: GoalDraft[]
  timeframeWeeks: Timeframe
  stats: StatsDraft
  units?: LoadUnit
  apiKey: string
  privacyLevel: PrivacyLevel
}

interface LoadedTemplate {
  file: string
  level: string
  program: Program
}

export function OnboardingScreen() {
  const navigate = useNavigate()
  const { program: activeProgram, loading, refresh } = useProgram()
  const [path, setPath] = useState<Step[]>(['1a'])
  const [answers, setAnswers] = useState<Answers>({
    goals: [],
    timeframeWeeks: 12,
    stats: { weight: '', bodyFat: '' },
    apiKey: '',
    privacyLevel: 'minimal',
  })
  const [templates, setTemplates] = useState<LoadedTemplate[] | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [today] = useState(() => new Date())

  const step = path[path.length - 1]
  const set = (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch }))
  const go = (next: Step) => {
    setPath((p) => [...p, next])
    window.scrollTo({ top: 0 })
  }
  const back = () => {
    setPath((p) => (p.length > 1 ? p.slice(0, -1) : p))
    window.scrollTo({ top: 0 })
  }

  // Starter programs come from public/templates/, precached for offline use.
  useEffect(() => {
    let live = true
    void Promise.all(
      STARTER_TEMPLATES.map(async (t) => {
        const response = await fetch(`${import.meta.env.BASE_URL}templates/${t.file}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = importProgramText(await response.text())
        if (!result.ok) throw new Error(result.errors[0])
        return { file: t.file, level: t.level, program: result.program }
      }),
    ).then(
      (loaded) => live && setTemplates(loaded),
      (error: Error) => live && setTemplateError(error.message),
    )
    return () => {
      live = false
    }
  }, [])

  const chosenProgram = answers.program?.program ?? null

  const exercises = useMemo(
    () => (chosenProgram ? loadRepsExercises(chosenProgram) : []),
    [chosenProgram],
  )
  const exerciseName = (id: string) => exercises.find((e) => e.id === id)?.name
  const units: LoadUnit = answers.units ?? unitFromGoals(answers.goals) ?? 'kg'
  const summary = goalSummary(answers.goals, answers.timeframeWeeks, exerciseName)

  if (loading) return null
  // An install that already has a program never sees onboarding (PLAN 7.5).
  if (activeProgram && !saving) return <Navigate to="/" replace />

  async function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = importProgramText(await file.text())
    if (!result.ok) {
      setImportErrors(result.errors)
      return
    }
    setImportErrors([])
    set({ program: { kind: 'import', program: result.program } })
    go('1f')
  }

  async function finish() {
    setSaveError(null)
    setSaving(true)
    const stage = { name: 'program' }
    try {
      const now = new Date()
      let saved: Program | null = null
      if (chosenProgram && answers.program) {
        const existing = (await listPrograms()).map((p) => p.id)
        saved =
          answers.program.kind === 'template'
            ? prepareTemplate(chosenProgram, now, units, existing)
            : answers.program.kind === 'built'
              ? // Built in step 4 before units were chosen: loads take the chosen unit.
                { ...applyUnit(chosenProgram, units), id: uniqueProgramId(chosenProgram.id, existing) }
              : { ...chosenProgram, id: uniqueProgramId(chosenProgram.id, existing) }
        await saveProgram(saved)
        stage.name = 'active program'
        await setActiveProgram(saved.id)
      }
      if (answers.goals.length > 0) {
        stage.name = 'goals'
        await saveGoals(
          toGoals(answers.goals, {
            timeframeWeeks: answers.timeframeWeeks,
            startDate: toISODate(now),
            currentStats: statsFromInput(answers.stats.weight, answers.stats.bodyFat, units),
            now,
          }),
        )
      }
      stage.name = 'settings'
      const current = (await getSettings()) ?? {}
      const key = answers.apiKey.trim()
      await saveSettings({
        ...current,
        units,
        privacyLevel: answers.privacyLevel,
        ...(key ? { apiKey: key } : {}),
        onboarding: {
          completedAt: now.toISOString(),
          followsProgram: answers.followsProgram,
          experience: answers.experience,
          safetyAckAt: answers.safetyAckAt,
        },
      })
      if (saved) void recordStoragePersistence()
      await refresh()
      navigate('/', { replace: true })
    } catch (error) {
      setSaving(false)
      setSaveError(`Could not save the ${stage.name}: ${(error as Error).message}`)
    }
  }

  const n = STEP_NUMBER[step]

  // ── 1a Welcome ──
  if (step === '1a') {
    return (
      <div className="ob">
        <StepNav step={1} />
        <div className="ob-hero">
          <h1 className="ob-hero__title">Build your own body</h1>
          <div className="ob-hero__text">
            BYOB-fit shows today&apos;s workout as a checklist and logs every set as you go. It can
            also track meals and, if you want, ask an AI to adjust your program.
          </div>
          <div className="ob-lockrow">
            <span className="ob-lockrow__icon">
              <LockIcon />
            </span>
            <div>
              <div className="ob-lockrow__title">Your data stays on this phone.</div>
              <div className="ob-lockrow__sub">No account, no sign-in.</div>
            </div>
          </div>
        </div>
        <Dock>
          <PrimaryButton onClick={() => go('1b')}>Get started</PrimaryButton>
        </Dock>
      </div>
    )
  }

  // ── 1b Two questions ──
  if (step === '1b') {
    return (
      <div className="ob">
        <StepNav step={n} onBack={back} />
        <StepHead step={n} title="Two quick questions" lede="Your answers decide the next steps." />
        <div className="ob-body">
          <div className="ob-q">Do you already follow a workout program?</div>
          <Segmented
            label="Do you already follow a workout program?"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={answers.followsProgram === undefined ? undefined : answers.followsProgram ? 'yes' : 'no'}
            onChange={(v) => set({ followsProgram: v === 'yes' })}
          />
          <div style={{ height: 30 }} />
          <div className="ob-q">Are you new to lifting, or experienced?</div>
        </div>
        <div className="ob-list ob-list--flush" role="radiogroup" aria-label="Are you new to lifting, or experienced?">
          <ChoiceRow
            title="New"
            sub="Just starting, or back after a long break"
            on={answers.experience === 'new'}
            onClick={() => set({ experience: 'new' })}
          />
          <ChoiceRow
            title="Experienced"
            sub="You know the main lifts and have trained before"
            on={answers.experience === 'experienced'}
            onClick={() => set({ experience: 'experienced' })}
          />
        </div>
        <Dock>
          <PrimaryButton
            disabled={answers.followsProgram === undefined || answers.experience === undefined}
            onClick={() => go('1c')}
          >
            Continue
          </PrimaryButton>
        </Dock>
      </div>
    )
  }

  // ── 1c Safety notice (D-029) ──
  if (step === '1c') {
    return (
      <div className="ob">
        <StepNav step={n} onBack={back} />
        <div className="ob-head">
          <div className="ob-step">Step 3 of 8</div>
          <h1 className="ob-title">Before you start</h1>
          <div className="ob-notice">
            BYOB-fit is not medical advice. Check with a doctor or physiotherapist before starting a
            new training program if you have a heart, lung, bone or joint condition, take medicine
            for your heart or blood pressure, are pregnant, are recovering from an injury or
            surgery, or have felt chest pain, dizziness or faintness during exercise.
          </div>
          <div className="ob-notice ob-notice--stop">
            During any workout, stop if you feel chest pain, severe breathlessness, dizziness or
            sharp pain.
          </div>
        </div>
        <Dock>
          <PrimaryButton
            onClick={() => {
              set({ safetyAckAt: new Date().toISOString() })
              go(answers.followsProgram ? '1d' : '1e')
            }}
          >
            I understand, continue
          </PrimaryButton>
        </Dock>
      </div>
    )
  }

  const skipProgram = () => {
    set({ program: null })
    go('1f')
  }

  // ── 1d Add your program (follows one). "Build it with forms" waits for Phase 8. ──
  if (step === '1d') {
    return (
      <div className="ob">
        <StepNav step={n} onBack={back} onSkip={skipProgram} />
        <StepHead step={n} title="How do you want to add your program?" lede="You can edit it any time after." />
        <div className="ob-list" role="radiogroup" aria-label="How do you want to add your program?">
          <ChoiceRow
            title="Build it with forms"
            sub="Add your days and exercises step by step. Works for any program."
            on
            onClick={() => go('forms')}
          />
        </div>
        <div className="ob-import">
          <label className="ob-link">
            Or import a program file
            <input type="file" accept=".json,application/json" onChange={(e) => void onImportFile(e)} />
          </label>
          <div className="ob-link__sub">If someone gave you a BYOB-fit .json file</div>
          {importErrors.length > 0 && (
            <div className="ob-errors" role="alert">
              {importErrors.length === 1 ? '1 problem' : `${importErrors.length} problems`}, nothing was
              loaded:
              <ul>
                {importErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Dock>
          <PrimaryButton onClick={() => go('forms')}>Continue</PrimaryButton>
        </Dock>
      </div>
    )
  }

  // ── Build it with forms (2e to 2j) ──
  if (step === 'forms') {
    return (
      <BuilderEntry
        mode="new"
        editing={null}
        today={today}
        currentWeek={1}
        unit={units}
        beginnerDefault={answers.experience === 'new'}
        onSave={async (program) => {
          set({ program: { kind: 'built', program } })
          // Back from step 5 returns to 1d, not to an emptied builder.
          setPath((p) => [...p.slice(0, -1), '1f'])
          window.scrollTo({ top: 0 })
        }}
        onExit={back}
        onDiscarded={back}
      />
    )
  }

  // ── 2a and 2b: the chosen starter program ──
  if (step === '2a') {
    const file = answers.templateFile ?? suggestedTemplate(answers.experience)
    const loaded = templates?.find((t) => t.file === file)
    if (!loaded) return null
    const kept = answers.program?.kind === 'template' && answers.program.file === file ? answers.program.program : loaded.program
    return (
      <StarterReview
        key={file}
        template={kept}
        level={loaded.level}
        templates={templates}
        beginnerDefault={answers.experience === 'new'}
        unit={units}
        onBack={back}
        onUse={(program) => {
          set({ program: { kind: 'template', file, program } })
          go('1f')
        }}
      />
    )
  }

  // ── 1e Pick a starter program ──
  if (step === '1e') {
    const suggested = suggestedTemplate(answers.experience)
    const selected = answers.templateFile ?? suggested
    return (
      <div className="ob">
        <StepNav step={n} onBack={back} onSkip={skipProgram} />
        <StepHead
          step={n}
          title="Pick a starter program"
          lede="You can change days, exercises and weights later."
        />
        <div className="ob-list" role="radiogroup" aria-label="Starter programs">
          {templates?.map((t) => {
            const minutes = longestSessionMin(t.program)
            return (
              <ChoiceRow
                key={t.file}
                title={t.program.name}
                badge={t.file === suggested ? 'Suggested for you' : undefined}
                sub={[
                  `${trainingDays(t.program)} days a week`,
                  minutes !== null ? `about ${minutes} min` : null,
                  t.level,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                on={selected === t.file}
                onClick={() => set({ templateFile: t.file })}
              />
            )
          })}
        </div>
        {templateError && (
          <div className="ob-pad ob-errors" role="alert">
            Could not load the starter programs ({templateError}). Skip for now and import a program
            later.
          </div>
        )}
        <Dock>
          <PrimaryButton
            disabled={!templates}
            onClick={() => {
              set({ templateFile: selected })
              go('2a')
            }}
          >
            Use this program
          </PrimaryButton>
        </Dock>
      </div>
    )
  }

  const skipGoals = () => {
    set({ goals: [] })
    go('1i')
  }

  // ── 1f Choose goals ──
  if (step === '1f') {
    return (
      <div className="ob">
        <StepNav step={n} onBack={back} onSkip={skipGoals} />
        <StepHead
          step={n}
          title="What do you want to work toward?"
          lede="Pick one main goal. Add up to two more if you like."
        />
        <div className="ob-list">
          <GoalPicker goals={answers.goals} unit={units} onChange={(goals) => set({ goals })} />
        </div>
        <Dock>
          <PrimaryButton disabled={!goalsValid(answers.goals)} onClick={() => go('1g')}>
            Continue
          </PrimaryButton>
        </Dock>
      </div>
    )
  }

  // ── 1g Targets and timeframe ──
  if (step === '1g') {
    return (
      <div className="ob">
        <StepNav step={n} onBack={back} onSkip={skipGoals} />
        <StepHead step={n} title="Set a target and a timeframe" />
        <div className="ob-pad">
          <GoalTargets goals={answers.goals} exercises={exercises} onChange={(goals) => set({ goals })} />
          <TimeframePicker
            heading="In how many weeks?"
            weeks={answers.timeframeWeeks}
            start={today}
            showEnd
            onChange={(timeframeWeeks) => set({ timeframeWeeks })}
          />
        </div>
        <Dock>
          <PrimaryButton onClick={() => go('1h')}>Continue</PrimaryButton>
        </Dock>
      </div>
    )
  }

  // ── 1h Order, summary, current stats ──
  if (step === '1h') {
    return (
      <div className="ob">
        <StepNav step={n} onBack={back} onSkip={skipGoals} />
        <StepHead step={n} title="Put your goals in order" lede="Drag to change which comes first." />
        <div className="ob-list" style={{ marginTop: 20 }}>
          <GoalRanking goals={answers.goals} exerciseName={exerciseName} onChange={(goals) => set({ goals })} />
        </div>
        <GoalBox summary={summary} />
        <CurrentStats stats={answers.stats} unit={units} onChange={(stats) => set({ stats })} />
        <Dock>
          <PrimaryButton onClick={() => go('1i')}>Continue</PrimaryButton>
        </Dock>
      </div>
    )
  }

  // ── 1i Units ──
  if (step === '1i') {
    return (
      <div className="ob">
        <StepNav
          step={n}
          onBack={back}
          onSkip={() => {
            set({ units })
            go('1j')
          }}
        />
        <StepHead step={n} title="Which units do you use?" lede="For weights on your sets and body weight." />
        <div className="ob-list" role="radiogroup" aria-label="Units">
          <ChoiceRow title="Pounds (lb)" on={units === 'lb'} onClick={() => set({ units: 'lb' })} />
          <ChoiceRow title="Kilograms (kg)" on={units === 'kg'} onClick={() => set({ units: 'kg' })} />
        </div>
        <div className="ob-pad ob-note" style={{ marginTop: 14 }}>
          You can change this in Settings.
        </div>
        <Dock>
          <PrimaryButton
            onClick={() => {
              set({ units })
              go('1j')
            }}
          >
            Continue
          </PrimaryButton>
        </Dock>
      </div>
    )
  }

  // ── 1j AI intro ──
  if (step === '1j') {
    return (
      <AIIntroStep
        step={n}
        onBack={back}
        onSetUp={() => go('1k')}
        onSkip={() => {
          set({ apiKey: '' })
          go('1l')
        }}
      />
    )
  }

  // ── 1k Key and privacy level (D-031) ──
  if (step === '1k') {
    return (
      <AIKeyStep
        step={n}
        apiKey={answers.apiKey}
        onApiKey={(apiKey) => set({ apiKey })}
        privacyLevel={answers.privacyLevel}
        onPrivacyLevel={(privacyLevel) => set({ privacyLevel })}
        showTip={answers.experience === 'new'}
        onBack={back}
        onSkip={() => {
          set({ apiKey: '' })
          go('1l')
        }}
        onSave={() => go('1l')}
      />
    )
  }

  // ── 1l Summary ──
  const programName = chosenProgram?.name ?? 'None yet, import one next'
  return (
    <div className="ob">
      <StepNav step={n} onBack={back} />
      <StepHead
        step={n}
        title="You're set"
        lede="Here is what you chose. All of it can be changed later."
      />
      <div className="ob-list">
        <div className="ob-summary">
          <span className="ob-summary__label">Program</span>
          <span className="ob-summary__value">{programName}</span>
        </div>
        <div className="ob-summary">
          <span className="ob-summary__label">Goal</span>
          <span className="ob-summary__value">{summary ? summary.replace(/\.$/, '') : 'Not set'}</span>
        </div>
        <div className="ob-summary">
          <span className="ob-summary__label">Units</span>
          <span className="ob-summary__value">{units === 'lb' ? 'Pounds' : 'Kilograms'}</span>
        </div>
        <div className="ob-summary">
          <span className="ob-summary__label">AI help</span>
          <span className="ob-summary__value">
            {answers.apiKey.trim() ? 'On, key saved on this phone' : 'Off, set up in Settings'}
          </span>
        </div>
      </div>
      {saveError && (
        <div className="ob-pad ob-errors" role="alert">
          {saveError}
        </div>
      )}
      <Dock>
        <PrimaryButton disabled={saving} onClick={() => void finish()}>
          Go to Today
        </PrimaryButton>
      </Dock>
    </div>
  )
}
