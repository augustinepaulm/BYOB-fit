// Profile's "Edit program" and "Start a new program" (EXEC-08 task 8, D-042
// rules 5 and 6). A new program becomes active on Save; the previous one and
// its sessions stay stored.

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { listPrograms, saveProgram, setActiveProgram } from '../db/index.ts'
import { BuilderEntry } from '../builder/BuilderEntry.tsx'
import { readDraft } from '../builder/draft.ts'
import { StarterReview } from '../builder/StarterReview.tsx'
import { BuilderBar, ChevronRight, Hero } from '../builder/ui.tsx'
import { useStarterTemplates, type LoadedTemplate } from '../builder/useLibrary.ts'
import { importProgramText } from '../lib/importProgram.ts'
import { longestSessionMin, prepareTemplate, trainingDays, uniqueProgramId } from '../lib/onboarding.ts'
import { SectionHead } from '../onboarding/ui.tsx'
import { useProgram } from '../program/useProgram.ts'
import { unitsOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Program } from '../types/program.ts'
import { ImportErrorState } from '../ui/StateBlock.tsx'

/** Save a program as a new one (fresh id if taken) and make it active. */
async function saveAsNew(program: Program): Promise<void> {
  const ids = (await listPrograms()).map((p) => p.id)
  const saved = { ...program, id: uniqueProgramId(program.id, ids) }
  await saveProgram(saved)
  await setActiveProgram(saved.id)
}

export function EditProgramScreen() {
  const navigate = useNavigate()
  const { program, today, week, refresh } = useProgram()
  const { settings, loading } = useSettings()
  if (loading || !program) return null
  return (
    <BuilderEntry
      mode="edit"
      editing={program}
      today={today}
      currentWeek={week}
      unit={unitsOf(settings)}
      beginnerDefault={settings.onboarding?.experience === 'new'}
      onSave={async (saved, mode) => {
        if (mode === 'edit') await saveProgram(saved)
        else await saveAsNew(saved)
        await refresh()
        navigate(mode === 'edit' ? '/profile' : '/', { replace: true })
      }}
      onExit={() => navigate('/profile')}
      onDiscarded={() => navigate('/profile', { replace: true })}
    />
  )
}

type Choice = null | 'forms' | { starter: LoadedTemplate }

export function NewProgramScreen() {
  const navigate = useNavigate()
  const { today, week, refresh } = useProgram()
  const { settings, loading } = useSettings()
  const { templates, error } = useStarterTemplates()
  // "Build my own" from a no-program state (7a) opens the builder directly.
  const buildFirst = (useLocation().state as { build?: boolean } | null)?.build === true
  const [choice, setChoice] = useState<Choice>(buildFirst ? 'forms' : null)
  const [checked, setChecked] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  // A waiting draft is resumed straight away (D-042 rule 1).
  useEffect(() => {
    let live = true
    void readDraft().then((draft) => {
      if (!live) return
      if (draft) setChoice('forms')
      setChecked(true)
    })
    return () => {
      live = false
    }
  }, [])

  if (loading || !checked) return null
  const unit = unitsOf(settings)
  const beginner = settings.onboarding?.experience === 'new'
  const done = async () => {
    await refresh()
    navigate('/', { replace: true })
  }

  if (choice === 'forms') {
    return (
      <BuilderEntry
        mode="new"
        editing={null}
        today={today}
        currentWeek={week}
        unit={unit}
        beginnerDefault={beginner}
        onSave={async (saved, mode) => {
          if (mode === 'edit') await saveProgram(saved)
          else await saveAsNew(saved)
          await done()
        }}
        onExit={() => setChoice(null)}
        onDiscarded={() => setChoice(null)}
      />
    )
  }

  if (choice) {
    return (
      <StarterReview
        template={choice.starter.program}
        level={choice.starter.level}
        templates={templates}
        beginnerDefault={beginner}
        unit={unit}
        onBack={() => setChoice(null)}
        onUse={(program) =>
          void (async () => {
            const ids = (await listPrograms()).map((p) => p.id)
            await saveAsNew(prepareTemplate(program, today, unit, ids))
            await done()
          })()
        }
      />
    )
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = importProgramText(await file.text())
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    await saveAsNew(result.program)
    await done()
  }

  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <BuilderBar title="New program" onBack={() => navigate('/profile')} />
      <Hero title="Start a new program" sub="Your current program and its history stay stored." />
      <div className="ob-pad">
        <SectionHead>Starter programs</SectionHead>
        {templates?.map((t) => {
          const minutes = longestSessionMin(t.program)
          return (
            <button type="button" className="bd-day" key={t.file} onClick={() => setChoice({ starter: t })}>
              <span className="bd-day__main">
                <div className="bd-day__name">{t.program.name}</div>
                <div className="bd-day__sub">
                  {[`${trainingDays(t.program)} days a week`, minutes !== null ? `about ${minutes} min` : null, t.level].filter(Boolean).join(' · ')}
                </div>
              </span>
              <ChevronRight />
            </button>
          )
        })}
        {error && <div className="ob-errors">Could not load the starter programs ({error}).</div>}
        <SectionHead>Your own</SectionHead>
        <button type="button" className="bd-day" onClick={() => setChoice('forms')}>
          <span className="bd-day__main">
            <div className="bd-day__name">Build it with forms</div>
            <div className="bd-day__sub">Add your days and exercises step by step. Works for any program.</div>
          </span>
          <ChevronRight />
        </button>
        <label className="bd-day" style={{ cursor: 'pointer' }}>
          <span className="bd-day__main">
            <div className="bd-day__name">Import a program file</div>
            <div className="bd-day__sub">If someone gave you a BYOB-fit .json file</div>
          </span>
          <ChevronRight />
          <input ref={fileInput} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => void onFile(e)} />
        </label>
        {errors.length > 0 && <ImportErrorState errors={errors} onChoose={() => fileInput.current?.click()} />}
      </div>
    </div>
  )
}
