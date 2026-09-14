import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  getProfile,
  listSessionsBetween,
  saveProgram,
  saveReprogram,
} from '../db/index.ts'
import { sendMessage, stripCodeFences } from '../lib/anthropic.ts'
import { toISODate } from '../lib/dates.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { resolveItem, weekDates } from '../lib/program.ts'
import {
  REPROGRAM_SYSTEM_PROMPT,
  applyProposal,
  buildDiff,
  buildReprogramMessage,
  validateProposal,
  type DiffGroup,
  type Proposal,
} from '../lib/reprogram.ts'
import { useProgram } from '../program/useProgram.ts'
import { useSettings } from '../settings/useSettings.ts'
import { ChevronLeftIcon } from '../ui/icons.tsx'

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; text: string; errors?: string[] }
  | { kind: 'proposal'; proposal: Proposal; groups: DiffGroup[]; raw: string }

export function BuildScreen() {
  const { program, week, refresh } = useProgram()
  const { settings, loading: settingsLoading } = useSettings()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  // One request per visit: a retry that fires on its own could double-spend.
  const sent = useRef(false)

  const targetWeek = week + 1

  const run = useCallback(async () => {
    if (!program) return
    setPhase({ kind: 'loading' })
    const dates = weekDates(program, week)
    const sessions = (
      await listSessionsBetween(
        toISODate(dates[0]),
        toISODate(dates[dates.length - 1]),
      )
    ).filter((session) => session.endedAt)
    const profile = await getProfile()
    const message = buildReprogramMessage({
      program,
      sessions,
      profile,
      rules: settings.rules ?? '',
      targetWeek,
    })
    const result = await sendMessage(
      {
        apiKey: settings.apiKey ?? '',
        model: settings.model ?? '',
        maxTokens: 8192,
        system: REPROGRAM_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
      },
      180_000,
    )
    if (!result.ok) {
      setPhase({ kind: 'error', text: result.error })
      return
    }
    let payload: unknown
    try {
      payload = JSON.parse(stripCodeFences(result.text))
    } catch {
      setPhase({
        kind: 'error',
        text: 'The model did not return JSON.',
        errors: [result.text.slice(0, 400)],
      })
      return
    }
    const checked = validateProposal(payload, program, targetWeek)
    if (!checked.ok) {
      setPhase({
        kind: 'error',
        text: 'The proposal did not match the program. Nothing was applied.',
        errors: checked.errors,
      })
      return
    }
    setPhase({
      kind: 'proposal',
      proposal: checked.proposal,
      groups: buildDiff(
        program,
        checked.proposal,
        week,
        resolveItem,
        prescriptionText,
      ),
      raw: result.text,
    })
  }, [program, week, targetWeek, settings])

  useEffect(() => {
    if (settingsLoading || !program || sent.current) return
    sent.current = true
    void run()
  }, [settingsLoading, program, run])

  async function record(proposal: Proposal, raw: string, approved: boolean) {
    await saveReprogram({
      id: `${proposal.week}__${new Date().toISOString()}`,
      week: proposal.week,
      timestamp: new Date().toISOString(),
      model: settings.model ?? '',
      raw,
      approved,
    })
  }

  async function approve(proposal: Proposal, raw: string) {
    if (!program) return
    setBusy(true)
    await saveProgram(applyProposal(program, proposal))
    await record(proposal, raw, true)
    await refresh()
    navigate('/week', { replace: true })
  }

  async function discard(proposal: Proposal, raw: string) {
    setBusy(true)
    await record(proposal, raw, false)
    navigate('/week', { replace: true })
  }

  if (!program) return null

  return (
    <div className="page">
      <div className="proposal-head">
        <button type="button" aria-label="Back" onClick={() => navigate('/week')}>
          <ChevronLeftIcon />
        </button>
        <div>
          <div className="proposal-head__title">Proposal for week {targetWeek}</div>
          <div className="proposal-head__body">
            Changes against week {week} · nothing is applied until you approve
          </div>
        </div>
      </div>

      {phase.kind === 'loading' && (
        <div className="state-panel" style={{ marginTop: 20 }}>
          <div className="spinner" />
          <div className="state-panel__title">Building week {targetWeek}</div>
          <div className="state-panel__body">
            Sending this week&apos;s log to your model. Usually under a minute.
          </div>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="state-panel" style={{ marginTop: 20 }}>
          <div className="state-panel__title">{phase.text}</div>
          <div className="state-panel__body">
            Check your key in Settings, then try again.
          </div>
          {phase.errors && phase.errors.length > 0 && (
            <ul className="errors__list" style={{ textAlign: 'left' }}>
              {phase.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-inline"
              onClick={() => navigate('/settings')}
            >
              Open Settings
            </button>
            <button type="button" className="btn-inline" onClick={() => void run()}>
              Retry
            </button>
          </div>
        </div>
      )}

      {phase.kind === 'proposal' && (
        <>
          {phase.proposal.notes && (
            <p className="muted-line" style={{ marginTop: 8 }}>
              {phase.proposal.notes}
            </p>
          )}
          {phase.groups.length === 0 ? (
            <p className="muted-line" style={{ marginTop: 16 }}>
              The model proposed no changes for week {targetWeek}.
            </p>
          ) : (
            phase.groups.map((group) => (
              <div key={group.dayId}>
                <div className="diff-day">{group.title}</div>
                <div className="diff-card">
                  {group.rows.map((row, i) => (
                    <div className={`diff-row diff-row--${row.kind}`} key={i}>
                      <div style={{ minWidth: 0 }}>
                        <div className="diff-row__name">
                          {row.name}
                          {row.perSide && (
                            <span
                              style={{
                                fontWeight: 400,
                                color: 'var(--muted)',
                                fontSize: 13,
                              }}
                            >
                              {' '}
                              · per side
                            </span>
                          )}
                        </div>
                        {row.kind === 'changed' ? (
                          row.fields.map((field) => (
                            <div className="diff-row__field" key={field.label}>
                              {field.label}: <s>{field.from}</s> → {field.to}
                            </div>
                          ))
                        ) : (
                          <div className="diff-row__field">{row.summary}</div>
                        )}
                        {row.mergesExisting && (
                          <div className="diff-row__field">
                            merges into the week {targetWeek} override this item
                            already has
                          </div>
                        )}
                        {row.reason && (
                          <div className="diff-row__reason">{row.reason}</div>
                        )}
                      </div>
                      <span className={`diff-tag diff-tag--${row.kind}`}>
                        {row.kind}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <div className="proposal-actions">
            <button
              type="button"
              className="is-secondary"
              disabled={busy}
              onClick={() => void discard(phase.proposal, phase.raw)}
            >
              Discard
            </button>
            <button
              type="button"
              className="is-primary"
              disabled={busy}
              onClick={() => void approve(phase.proposal, phase.raw)}
            >
              Approve week {targetWeek}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
