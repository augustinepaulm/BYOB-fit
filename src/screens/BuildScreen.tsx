// "Ask AI" from the Update program sheet (D-027, D-043 rule 1): preview, call,
// then one whole patch to approve or discard (frame 4f), states in 4g. The
// route is the v1 /build route; the flow is the Phase 9 update.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { sendAndLog } from '../ai/send.ts'
import { AISetupFlow, OfflineBar, StatePanel } from '../ai/parts.tsx'
import { useOnline, usePreview } from '../ai/usePreview.tsx'
import { BuilderBar, Hero } from '../builder/ui.tsx'
import { getGoals, listAllSessions, listBodyEntries, saveProgram, saveReprogram } from '../db/index.ts'
import { stripCodeFences } from '../lib/anthropic.ts'
import { findItem, itemsWithHistory } from '../lib/builder.ts'
import { toISODate } from '../lib/dates.ts'
import { buildPayload, type Payload } from '../lib/payload.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { parseISODate, weekDates } from '../lib/program.ts'
import { REPROGRAM_SYSTEM_PROMPT, validateProposal, type Proposal } from '../lib/reprogram.ts'
import { changeText } from '../lib/review.ts'
import { appliesFromText, applyUpdate, dayDate, startedDays, weekFor } from '../lib/update.ts'
import { Dock, SectionHead } from '../onboarding/ui.tsx'
import { useProgram } from '../program/useProgram.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Day } from '../types/program.ts'
import type { BodyEntry, Goals, PrivacyLevel, Session } from '../types/stores.ts'

type Phase =
  | { kind: 'ready' }
  | { kind: 'loading' }
  | { kind: 'error'; title: string; body: string; errors?: string[]; settingsLink?: boolean }
  | { kind: 'result'; proposal: Proposal; raw: string }

const STARTS = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export function BuildScreen() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const { program, week, today, refresh } = useProgram()
  const { settings, loading, update } = useSettings()
  const online = useOnline()
  const [goals, setGoals] = useState<Goals | null | undefined>(undefined)
  const [sessions, setSessions] = useState<Session[]>([])
  // D-084 rule 2: body entries go at every level.
  const [bodyEntries, setBodyEntries] = useState<BodyEntry[]>([])
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  const [busy, setBusy] = useState(false)
  const todayIso = toISODate(today)

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

  const thisWeek = useMemo(() => {
    if (!program) return []
    const dates = weekDates(program, week).map(toISODate)
    return sessions.filter((s) => s.date >= dates[0] && s.date <= dates[6])
  }, [program, week, sessions])
  const finished = thisWeek.filter((s) => s.endedAt)
  const started = useMemo(() => (program ? startedDays(program, week, thisWeek, todayIso) : new Set<string>()), [program, week, thisWeek, todayIso])
  const ctx = useMemo(() => ({ week, started, history: itemsWithHistory(sessions) }), [week, started, sessions])

  const send = useCallback(
    async (payload: Payload, level: PrivacyLevel) => {
      if (!program) return
      setPhase({ kind: 'loading' })
      const result = await sendAndLog({ kind: 'update', level, payload, system: REPROGRAM_SYSTEM_PROMPT, settings, maxTokens: 8192, timeoutMs: 180_000 })
      if (!result.ok) {
        setPhase({ kind: 'error', title: "Couldn't reach the model", body: 'Check your key in Settings.', errors: [result.error], settingsLink: true })
        return
      }
      let reply: unknown
      try {
        reply = JSON.parse(stripCodeFences(result.text))
      } catch {
        setPhase({ kind: 'error', title: 'The update was not readable', body: 'The model did not return JSON. Nothing was applied.' })
        return
      }
      const checked = validateProposal(reply, program, week)
      if (!checked.ok) {
        setPhase({ kind: 'error', title: 'The update did not match the program', body: 'Nothing was applied.', errors: checked.errors })
        return
      }
      setPhase({ kind: 'result', proposal: checked.proposal, raw: result.text })
    },
    [program, settings, week],
  )

  const preview = usePreview({
    kind: 'update',
    settings,
    build: (level, includeNotes) =>
      buildPayload('update', level, includeNotes, {
        program,
        // D-027: the sessions logged so far this week.
        sessions: finished,
        goals,
        rules: settings.rules ?? '',
        settings,
        week,
        startedDayIds: [...started].sort(),
        bodyEntries,
      }),
    onLevel: (privacyLevel) => void update({ privacyLevel }),
    onSend: (payload, level) => void send(payload, level),
    onCancel: () => navigate('/week'),
  })

  const { open } = preview
  const ready = !loading && goals !== undefined && Boolean(program)
  const hasKey = Boolean(settings.apiKey)
  useEffect(() => {
    if (ready && hasKey && online) open()
    // Once per visit: a retry is the user's choice, never automatic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hasKey])

  if (!ready || !program) return null
  if (preview.picking) return <>{preview.element}</>

  const bar = <BuilderBar title="Proposed update" onBack={() => navigate('/week')} />

  if (!hasKey) {
    if (search === '?setup') {
      return <AISetupFlow settings={settings} onCancel={() => navigate('/week')} onSaved={(patch) => void update(patch)} />
    }
    return (
      <div className="ob" style={{ paddingBottom: 40 }}>
        {!online && <OfflineBar />}
        {bar}
        <StatePanel icon="?" title="Set up AI to use this" body="It takes about two minutes and you pay Anthropic directly. You can also edit the program yourself.">
          <button type="button" className="ai-btn ai-btn--primary" onClick={() => navigate('/build?setup')}>
            Set up AI
          </button>
          <button type="button" className="ai-btn" onClick={() => navigate('/program/edit')}>
            Edit it myself
          </button>
        </StatePanel>
      </div>
    )
  }

  if (phase.kind !== 'result') {
    return (
      <div className="ob" style={{ paddingBottom: 40 }}>
        {!online && <OfflineBar />}
        {bar}
        {phase.kind === 'loading' && (
          <StatePanel
            icon="spin"
            title="Building your update"
            body={`Using ${finished.length} logged ${finished.length === 1 ? 'session' : 'sessions'} against your goal.`}
          />
        )}
        {phase.kind === 'error' && (
          <StatePanel icon="!" title={phase.title} body={phase.body} errors={phase.errors}>
            {phase.settingsLink && (
              <button type="button" className="ai-btn ai-btn--primary" onClick={() => navigate('/settings')}>
                Open Settings
              </button>
            )}
            <button type="button" className="ai-btn" disabled={!online} onClick={() => preview.open()}>
              Retry
            </button>
          </StatePanel>
        )}
        {phase.kind === 'ready' && !online && (
          <StatePanel icon="!" title="You're offline" body="AI features need a connection. Try again once you're back online.">
            <button type="button" className="ai-btn" onClick={() => navigate('/program/edit')}>
              Edit it myself
            </button>
          </StatePanel>
        )}
        {phase.kind === 'ready' && online && (
          <StatePanel icon="?" title="Nothing sent" body="Open the preview to see what would be sent.">
            <button type="button" className="ai-btn ai-btn--primary" onClick={() => preview.open()}>
              Review what's sent
            </button>
          </StatePanel>
        )}
        {preview.element}
      </div>
    )
  }

  const { proposal, raw } = phase
  const applied = applyUpdate(program, proposal, ctx)

  async function record(approved: boolean) {
    await saveReprogram({
      id: `${proposal.week}__${new Date().toISOString()}`,
      week: proposal.week,
      timestamp: new Date().toISOString(),
      model: settings.model ?? '',
      raw,
      approved,
    })
  }

  async function approve() {
    setBusy(true)
    await saveProgram(applied.program)
    await record(true)
    await refresh()
    navigate('/week', { replace: true })
  }

  async function discard() {
    setBusy(true)
    await record(false)
    navigate('/week', { replace: true })
  }

  // One group per day, in weekday order.
  const dayOf = (itemId: string): Day | undefined => findItem(program, itemId)?.day
  const days = [...program.days].sort((a, b) => a.order - b.order)
  const rowsFor = (day: Day) => {
    const rows: { mark: '~' | '−' | '+'; text: React.ReactNode; reason: string; key: string }[] = []
    proposal.overrides.forEach((o, i) => {
      if (dayOf(o.itemId)?.id !== day.id) return
      const t = changeText(program, findItem(program, o.itemId)!.item, o.fields, week)
      rows.push({
        key: `o${i}`,
        mark: '~',
        reason: o.reason,
        text: (
          <>
            {t.from === t.name ? <span style={{ color: 'var(--secondary)', textDecoration: 'line-through' }}>{t.name}</span> : t.name}{' '}
            {t.from !== t.name && <span style={{ color: 'var(--secondary)', textDecoration: 'line-through' }}>{t.from}</span>} → <b>{t.to}</b>
          </>
        ),
      })
    })
    proposal.remove.forEach((r, i) => {
      const found = findItem(program, r.itemId)
      if (found?.day.id !== day.id) return
      const section = found.day.sections.find((s) => s.items.includes(found.item))
      rows.push({
        key: `r${i}`,
        mark: '−',
        reason: r.reason,
        text: (
          <>
            <span style={{ textDecoration: 'line-through' }}>{program.exercises[found.item.exerciseId]?.name ?? found.item.exerciseId}</span>, {section?.title.toLowerCase()}
          </>
        ),
      })
    })
    proposal.add.forEach((a, i) => {
      if (a.dayId !== day.id) return
      const section = day.sections.find((s) => s.id === a.sectionId)
      const name = a.exercise?.name ?? program.exercises[a.item.exerciseId]?.name ?? a.item.exerciseId
      rows.push({
        key: `a${i}`,
        mark: '+',
        reason: a.reason,
        text: (
          <>
            <b>
              {name} {prescriptionText(a.item)}
            </b>
            , {section?.title.toLowerCase()}
          </>
        ),
      })
    })
    return rows
  }

  const total = proposal.overrides.length + proposal.add.length + proposal.remove.length
  return (
    <div className="ob" style={{ paddingBottom: 130 }}>
      {!online && <OfflineBar />}
      {bar}
      <Hero title={`Update for week ${proposal.week}`} sub={appliesFromText(program, proposal, ctx)} />
      <div className="ai-counts">
        <span>{proposal.add.length} added</span>
        <span>{proposal.overrides.length} changed</span>
        <span>{proposal.remove.length} removed</span>
      </div>
      <div className="ob-pad">
        {total === 0 && <div className="bd-hint" style={{ marginTop: 16 }}>No changes proposed.</div>}
        {days.map((day) => {
          const rows = rowsFor(day)
          if (rows.length === 0) return null
          const from = parseISODate(dayDate(program, day.id, weekFor(day.id, ctx)))
          return (
            <div key={day.id} style={{ marginTop: -10 }}>
              <SectionHead aside={`starts ${STARTS.format(from)}`}>{day.name}</SectionHead>
              {rows.map((row) => (
                <div className="ai-diff" key={row.key}>
                  <div className={row.mark === '−' ? 'ai-mark ai-mark--removed' : row.mark === '+' ? 'ai-mark ai-mark--added' : 'ai-mark'}>{row.mark}</div>
                  <div style={{ flex: 1 }}>
                    <div className="ai-diff__text">{row.text}</div>
                    {row.reason && <div className="ai-reason" style={{ marginTop: 4 }}>{row.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {applied.skipped.length > 0 && (
          <div className="bd-hint" style={{ marginTop: 12, color: 'var(--warn)' }}>
            {applied.skipped.length} {applied.skipped.length === 1 ? 'change falls' : 'changes fall'} after the program ends and will be left out.
          </div>
        )}
      </div>
      <div className="ai-whole">This is one update. It is approved or discarded as a whole. To change single lines, discard and edit it yourself.</div>
      <Dock>
        <div className="ai-pair">
          <button type="button" className="ob-outline" disabled={busy} onClick={() => void discard()}>
            Discard
          </button>
          <button type="button" className="ob-primary" disabled={busy} onClick={() => void approve()}>
            <span>Approve all</span>
          </button>
        </div>
      </Dock>
    </div>
  )
}
