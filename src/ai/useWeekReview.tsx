// "Review this week" on each Progress view (D-081; frames 3.11, 3.13, 4.04):
// behind the budget check and the send preview, kind week_note, stored in
// weekNotes with the week, view and reply, newest first.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { addWeekNote, listWeekNotes } from '../db/index.ts'
import { formatDayDate, toISODate } from '../lib/dates.ts'
import { buildPayload, type PayloadData, type WeekReviewData } from '../lib/payload.ts'
import { WEEK_NOTE_SYSTEM, newWeekNote, notesFor } from '../lib/weekNotes.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { PrivacyLevel, WeekNote } from '../types/stores.ts'
import { sendAndLog } from './send.ts'
import { useOnline, usePreview } from './usePreview.tsx'

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; text: string }

export interface WeekReviewControl {
  /** Notes for this week and view, newest first, and the loading or error card. */
  notes: ReactNode
  /** The "Review this week" button. */
  button: ReactNode
  /** The preview sheet, the budget block or the level picker. */
  element: ReactNode
  picking: boolean
}

export function useWeekReview(input: {
  enabled: boolean
  review: WeekReviewData
  /** Program, sessions, goals and body entries as the payload builder takes them. */
  data: Omit<PayloadData, 'weekReview' | 'settings' | 'rules'>
}): WeekReviewControl {
  const navigate = useNavigate()
  const { settings, update } = useSettings()
  const [notes, setNotes] = useState<WeekNote[]>([])
  const [state, setState] = useState<State>({ kind: 'idle' })
  const cancelled = useRef(false)
  const online = useOnline()
  const { weekStart, view, programWeek } = input.review

  useEffect(() => {
    let live = true
    void listWeekNotes(weekStart).then((found) => live && setNotes(found))
    return () => {
      live = false
    }
  }, [weekStart])

  async function send(payload: ReturnType<typeof buildPayload>, level: PrivacyLevel) {
    cancelled.current = false
    setState({ kind: 'sending' })
    const result = await sendAndLog({ kind: 'week_note', level, payload, system: WEEK_NOTE_SYSTEM, settings, maxTokens: 1024, timeoutMs: 60_000 })
    if (cancelled.current) return
    if (!result.ok) {
      setState({ kind: 'error', text: result.error })
      return
    }
    const note = newWeekNote({ weekStart, programWeek, view, reply: result.text, model: settings.model }, new Date())
    await addWeekNote(note)
    setNotes((all) => [note, ...all])
    setState({ kind: 'idle' })
  }

  const preview = usePreview({
    kind: 'week_note',
    settings,
    build: (level, includeNotes) => buildPayload('week_note', level, includeNotes, { ...input.data, weekReview: input.review, rules: settings.rules ?? '', settings }),
    onLevel: (privacyLevel) => void update({ privacyLevel }),
    onSend: (payload, level) => void send(payload, level),
  })

  const shown = notesFor(notes, weekStart, view)
  const label = `AI note · ${programWeek !== undefined ? `week ${programWeek}` : 'this week'}`
  const notesNode = (
    <>
      {state.kind === 'sending' && (
        <section className="card-v3 note-card" role="status">
          <span className="ai-tag">{label}</span>
          <p className="note-card__text note-card__text--muted">Sent. This usually takes a few seconds.</p>
          <button
            type="button"
            className="btn btn--tertiary note-card__cancel"
            onClick={() => {
              cancelled.current = true
              setState({ kind: 'idle' })
            }}
          >
            Cancel
          </button>
        </section>
      )}
      {state.kind === 'error' && (
        <section className="card-v3 card-v3--danger" role="alert">
          <h2 className="card-v3__danger-title">The review didn&apos;t come back</h2>
          <p className="card-v3__warn-body">{state.text}</p>
          <div className="card-v3__buttons">
            <button type="button" className="chip" onClick={() => navigate('/settings/ai')}>
              Check key in Settings
            </button>
            <button type="button" className="chip" onClick={() => preview.open()}>
              Try again
            </button>
          </div>
        </section>
      )}
      {shown.map((note) => (
        <section className="card-v3 note-card" key={note.id}>
          <div className="note-card__head">
            <span className="ai-tag">{label}</span>
            <span className="note-card__date">{formatDayDate(toISODate(new Date(note.at)))}</span>
          </div>
          <p className="note-card__text">{note.reply}</p>
        </section>
      ))}
    </>
  )

  const button = input.enabled ? (
    <div className="actions-v3">
      {!online ? (
        // 4.08: everything works offline except AI.
        <button type="button" className="btn btn--offline" disabled>
          Review this week when back online
        </button>
      ) : settings.apiKey ? (
        <button type="button" className="btn btn--secondary" disabled={state.kind === 'sending'} onClick={() => preview.open()}>
          Review this week
        </button>
      ) : (
        <>
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/settings/ai')}>
            Review this week
          </button>
          <p className="note-v3">Needs an AI key. Add one in Settings, AI.</p>
        </>
      )}
    </div>
  ) : null

  return { notes: notesNode, button, element: preview.element, picking: preview.picking }
}
