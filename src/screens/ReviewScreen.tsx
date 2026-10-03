// AI review (D-026, D-043 rule 2): preview, call, then each proposed change
// accepted or rejected on its own (frame 4c), states in 4d. Accepted lines
// edit the base program.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { sendAndLog } from '../ai/send.ts'
import { AISetupFlow, OfflineBar, StatePanel } from '../ai/parts.tsx'
import { useOnline, usePreview } from '../ai/usePreview.tsx'
import { BuilderBar, Hero } from '../builder/ui.tsx'
import { getGoals, listAllSessions, listBodyEntries, saveProgram } from '../db/index.ts'
import { stripCodeFences } from '../lib/anthropic.ts'
import { findItem, itemsLoggedOn, itemsWithHistory } from '../lib/builder.ts'
import { toISODate } from '../lib/dates.ts'
import { fromGoals, goalSummary } from '../lib/goals.ts'
import { buildPayload, type Payload } from '../lib/payload.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { validateProposal, type Proposal } from '../lib/reprogram.ts'
import { REVIEW_SYSTEM_PROMPT, acceptedOnly, applyReview, changeText, reviewLines } from '../lib/review.ts'
import { Dock, PrimaryButton, TickIcon } from '../onboarding/ui.tsx'
import { useProgram } from '../program/useProgram.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { BodyEntry, Goals, PrivacyLevel, Session } from '../types/stores.ts'

type Phase =
  | { kind: 'ready' }
  | { kind: 'loading' }
  | { kind: 'error'; title: string; body: string; errors?: string[]; settingsLink?: boolean }
  | { kind: 'result'; proposal: Proposal }

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function ReviewScreen() {
  const navigate = useNavigate()
  const { program, week, today, refresh } = useProgram()
  const { settings, loading, update } = useSettings()
  const online = useOnline()
  const [goals, setGoals] = useState<Goals | null | undefined>(undefined)
  const [sessions, setSessions] = useState<Session[]>([])
  // D-084 rule 2: body entries go at every level.
  const [bodyEntries, setBodyEntries] = useState<BodyEntry[]>([])
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  const [choices, setChoices] = useState<Record<string, 'accept' | 'reject'>>({})
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let live = true
    void Promise.all([getGoals(), listAllSessions(), listBodyEntries()]).then(([g, s, b]) => {
      if (!live) return
      setGoals(g ?? null)
      setSessions(s)
      setBodyEntries(b)
    })
    return () => {
      live = false
    }
  }, [])

  // The review reads the sessions logged with this program.
  const programSessions = useMemo(
    () => (program ? sessions.filter((s) => s.date >= program.startDate) : []),
    [program, sessions],
  )
  const goalText = goals ? goalSummary(fromGoals(goals), goals.timeframeWeeks, (id) => program?.exercises[id]?.name) : ''

  const send = useCallback(
    async (payload: Payload, level: PrivacyLevel) => {
      if (!program) return
      setPhase({ kind: 'loading' })
      setChoices({})
      const result = await sendAndLog({ kind: 'review', level, payload, system: REVIEW_SYSTEM_PROMPT, settings, maxTokens: 8192, timeoutMs: 180_000 })
      if (!result.ok) {
        setPhase({ kind: 'error', title: "Couldn't reach the model", body: 'Check your key in Settings.', errors: [result.error], settingsLink: true })
        return
      }
      let reply: unknown
      try {
        reply = JSON.parse(stripCodeFences(result.text))
      } catch {
        setPhase({ kind: 'error', title: 'The review was not readable', body: 'The model did not return JSON. Nothing was applied.' })
        return
      }
      // A review is not tied to a week; the app sets it before validating.
      const checked = validateProposal({ ...(reply as object), week }, program, week)
      if (!checked.ok) {
        setPhase({ kind: 'error', title: 'The review did not match the program', body: 'Nothing was applied.', errors: checked.errors })
        return
      }
      setPhase({ kind: 'result', proposal: checked.proposal })
    },
    [program, settings, week],
  )

  const preview = usePreview({
    kind: 'review',
    settings,
    build: (level, includeNotes) =>
      buildPayload('review', level, includeNotes, { program, sessions: programSessions, goals, rules: settings.rules ?? '', settings, bodyEntries }),
    onLevel: (privacyLevel) => void update({ privacyLevel }),
    onSend: (payload, level) => void send(payload, level),
    onCancel: () => navigate(-1),
  })

  // With a key, the preview opens as soon as the data is in.
  const { open } = preview
  const ready = !loading && goals !== undefined && program
  const hasKey = Boolean(settings.apiKey)
  useEffect(() => {
    if (ready && hasKey) open()
    // Once per visit: a retry is the user's choice, never automatic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hasKey])

  if (!ready || !program) return null
  if (preview.picking) return <>{preview.element}</>

  // No key: onboarding's AI steps on their own, then back here (frame 4a note).
  if (!hasKey) {
    return <AISetupFlow settings={settings} onCancel={() => navigate(-1)} onSaved={(patch) => void update(patch)} />
  }

  const bar = <BuilderBar title="AI review" onBack={() => navigate(-1)} />

  if (phase.kind !== 'result') {
    return (
      <div className="ob" style={{ paddingBottom: 40 }}>
        {!online && <OfflineBar />}
        {bar}
        {phase.kind === 'loading' && (
          <StatePanel icon="spin" title="Reviewing your program" body="Usually under a minute. Keep the app open until this finishes." />
        )}
        {phase.kind === 'error' && (
          <StatePanel icon="!" title={phase.title} body={phase.body} errors={phase.errors}>
            {phase.settingsLink && (
              <button type="button" className="ai-btn ai-btn--primary" onClick={() => navigate('/settings')}>
                Open Settings
              </button>
            )}
            <button type="button" className="ai-btn" onClick={() => preview.open()}>
              Retry
            </button>
          </StatePanel>
        )}
        {preview.element}
      </div>
    )
  }

  const { proposal } = phase
  const lines = reviewLines(proposal)
  if (lines.length === 0) {
    return (
      <div className="ob" style={{ paddingBottom: 40 }}>
        {bar}
        <StatePanel icon="✓" title="No changes suggested for your goal" body={`Your program already fits: ${goalText.charAt(0).toLowerCase()}${goalText.slice(1)}`}>
          <button type="button" className="ai-btn" onClick={() => navigate(-1)}>
            Done
          </button>
        </StatePanel>
      </div>
    )
  }

  const accepted = lines.filter((l) => choices[l.key] === 'accept').length

  async function apply() {
    if (!program) return
    setApplying(true)
    const todayIso = toISODate(today)
    const next = applyReview(program, acceptedOnly(proposal, new Set(lines.filter((l) => choices[l.key] === 'accept').map((l) => l.key))), {
      history: itemsWithHistory(sessions),
      today: todayIso,
      loggedToday: itemsLoggedOn(sessions, todayIso),
    })
    await saveProgram(next)
    await refresh()
    navigate('/', { replace: true })
  }

  return (
    <div className="ob" style={{ paddingBottom: 170 }}>
      {bar}
      <Hero
        title={`${lines.length} ${lines.length === 1 ? 'change' : 'changes'} suggested`}
        sub={goalText ? `Against your goal: ${goalText.charAt(0).toLowerCase()}${goalText.slice(1)}` : undefined}
      />
      <div style={{ margin: '12px 24px 0', borderTop: '1.5px solid var(--text)' }}>
        {lines.map((line) => {
          const choice = choices[line.key]
          let body: React.ReactNode
          let reason: string
          if (line.kind === 'override') {
            const o = proposal.overrides[line.index]
            const found = findItem(program, o.itemId)!
            const text = changeText(program, found.item, o.fields, week)
            reason = o.reason
            body = (
              <>
                <div className="ai-review-row__name">{text.name}</div>
                <div className="ai-change">
                  <span className="ai-change__from">{text.from}</span>
                  <span className="ai-change__arrow">→</span>
                  <span className="ai-change__to">{text.to}</span>
                </div>
              </>
            )
          } else if (line.kind === 'add') {
            const a = proposal.add[line.index]
            const day = program.days.find((d) => d.id === a.dayId)
            const name = a.exercise?.name ?? program.exercises[a.item.exerciseId]?.name ?? a.item.exerciseId
            reason = a.reason
            body = (
              <>
                <div className="ai-review-row__name">
                  {name}
                  {day ? `, ${WEEKDAYS[day.order]}` : ''}
                </div>
                <div className="ai-change">
                  <span className="ob-badge">New</span>
                  <span className="ai-change__to">{prescriptionText(a.item)}</span>
                </div>
              </>
            )
          } else {
            const r = proposal.remove[line.index]
            const found = findItem(program, r.itemId)!
            reason = r.reason
            body = (
              <>
                <div className="ai-review-row__name">
                  <span style={{ textDecoration: 'line-through' }}>{program.exercises[found.item.exerciseId]?.name ?? found.item.exerciseId}</span>, {WEEKDAYS[found.day.order]}
                </div>
                <div className="ai-change">
                  <span className="ai-change__from">{prescriptionText(found.item)}</span>
                  <span className="ai-change__arrow">→</span>
                  <span className="ai-change__to">Removed</span>
                </div>
              </>
            )
          }
          return (
            <div className="ai-review-row" key={line.key}>
              {body}
              {reason && <div className="ai-reason">{reason}</div>}
              <div className="ai-choice">
                <button
                  type="button"
                  aria-pressed={choice === 'reject'}
                  className={choice === 'reject' ? 'ai-choice__rejected' : undefined}
                  onClick={() => setChoices((c) => ({ ...c, [line.key]: 'reject' }))}
                >
                  {choice === 'reject' ? 'Rejected' : 'Reject'}
                </button>
                <button
                  type="button"
                  aria-pressed={choice === 'accept'}
                  className={choice === 'accept' ? 'ai-choice__on' : 'ai-choice__accept'}
                  onClick={() => setChoices((c) => ({ ...c, [line.key]: 'accept' }))}
                >
                  {choice === 'accept' ? (
                    <>
                      <TickIcon />
                      Accepted
                    </>
                  ) : (
                    'Accept'
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <Dock>
        <div className="ai-counter">
          <span style={{ whiteSpace: 'nowrap' }}>
            <b>
              {accepted} of {lines.length}
            </b>{' '}
            accepted
          </span>
          <span>{accepted === 0 ? 'Accept one to apply' : 'Nothing applies yet'}</span>
        </div>
        <PrimaryButton disabled={accepted === 0 || applying} onClick={() => void apply()}>
          Apply accepted changes
        </PrimaryButton>
      </Dock>
    </div>
  )
}
