// Frame 5e (privacy level) and frames 4h, 4i (send preview, D-031, D-044).

import { useState } from 'react'

import { BuilderBar, Hero, Switch } from '../builder/ui.tsx'
import { CALL_LABEL, LEVEL_LABEL, PRIVACY_LEVELS, type CallKind, type Payload } from '../lib/payload.ts'
import { ChevronDown, ChoiceRow } from '../onboarding/ui.tsx'
import type { PrivacyLevel } from '../types/stores.ts'

const TABLE: { label: string; cells: ('yes' | 'no' | 'opt')[] }[] = [
  { label: 'Workouts, program, goal, your rules', cells: ['yes', 'yes', 'yes'] },
  { label: 'Experience level, "felt off" flags', cells: ['no', 'yes', 'yes'] },
  { label: 'Age range, sex, current weight', cells: ['no', 'no', 'yes'] },
  { label: 'Free-text session notes', cells: ['no', 'no', 'opt'] },
  { label: 'Name, date of birth, body stats history', cells: ['no', 'no', 'no'] },
]

/** Frame 5e. */
export function PrivacyLevelPicker({
  value,
  onChange,
  onBack,
}: {
  value: PrivacyLevel
  onChange: (level: PrivacyLevel) => void
  onBack: () => void
}) {
  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <BuilderBar title="Settings" onBack={onBack} />
      <Hero title="Privacy level" sub="Controls what the AI can see. You always get a preview before anything is sent." />
      <div className="ob-list" style={{ marginTop: 12 }} role="radiogroup" aria-label="Privacy level">
        {PRIVACY_LEVELS.map((level) => (
          <ChoiceRow
            key={level.value}
            title={level.title}
            sub={level.sub}
            badge={level.value === 'minimal' ? 'Default' : undefined}
            on={value === level.value}
            onClick={() => onChange(level.value)}
          />
        ))}
      </div>
      <div style={{ margin: '20px 24px 0' }}>
        <div className="ai-grid ai-grid--head">
          <span>Sent to AI</span>
          <span>Min</span>
          <span>Std</span>
          <span>Full</span>
        </div>
        {TABLE.map((row) => (
          <div className="ai-grid" key={row.label}>
            <span style={{ lineHeight: 1.35, padding: '6px 0' }}>{row.label}</span>
            {row.cells.map((cell, i) =>
              cell === 'yes' ? (
                <span className="ai-yes" key={i}>✓</span>
              ) : cell === 'opt' ? (
                <span className="ai-optin" key={i}>Opt-in</span>
              ) : (
                <span className="ai-no" key={i}>–</span>
              ),
            )}
          </div>
        ))}
      </div>
      <div style={{ margin: '8px 24px 0', fontSize: 12, color: 'var(--secondary)' }}>The last row is never sent at any level.</div>
    </div>
  )
}

/**
 * Frames 4h and 4i: what will be sent, built by the same function as the
 * request. Nothing is sent or logged until Send.
 */
export function SendPreview({
  kind,
  level,
  includeNotes,
  onIncludeNotes,
  payload,
  offline,
  onChangeLevel,
  onCancel,
  onSend,
}: {
  kind: CallKind
  level: PrivacyLevel
  includeNotes: boolean
  onIncludeNotes: (on: boolean) => void
  payload: Payload
  offline: boolean
  onChangeLevel: () => void
  onCancel: () => void
  onSend: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="bd-scrim" onClick={onCancel} />
      <div className="bd-sheet ai-sheet" role="dialog" aria-modal="true" aria-label="Send preview">
        <div className="bd-sheet__grab" />
        <div className="ai-for">For: {CALL_LABEL[kind]}</div>
        <h2 className="ai-sheet__title">This will be sent to Anthropic under your key</h2>
        <div className="ai-lines">
          {payload.summary.map((line) => (
            <div className="ai-line" key={line.label}>
              <span className="ai-line__label">{line.label}</span>
              <span className="ai-line__value">{line.value}</span>
            </div>
          ))}
        </div>
        <button type="button" className="ai-show" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          Show exactly what’s sent
          <span style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : undefined }}>
            <ChevronDown />
          </span>
        </button>
        {open && <pre className="ai-raw" aria-label="Exact message">{payload.message}</pre>}
        {level === 'full' && kind !== 'meals' && (
          <div className="bd-toggle-row" style={{ marginTop: 0, borderTop: '1px solid var(--hairline)' }}>
            <span>Include notes</span>
            <Switch label="Include notes" on={includeNotes} onChange={onIncludeNotes} />
          </div>
        )}
        <div className="ai-level">
          <span>
            Privacy level: <b>{LEVEL_LABEL[level]}</b>
          </span>
          <button type="button" className="ai-level__change" onClick={onChangeLevel}>
            Change
          </button>
        </div>
        <div className="ai-never">Never sent: name, date of birth, body stats history.</div>
        {offline && <div className="ai-never" style={{ color: 'var(--warn)', marginTop: 8 }}>You're offline. Logging works; AI features need a connection.</div>}
        <div className="ai-pair" style={{ marginTop: 16 }}>
          <button type="button" className="ob-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="ob-primary" disabled={offline} onClick={onSend}>
            <span>Send</span>
          </button>
        </div>
      </div>
    </>
  )
}
