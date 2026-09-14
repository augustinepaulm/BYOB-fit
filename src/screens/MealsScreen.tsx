import { useEffect, useMemo, useState } from 'react'

import { getMealDay, saveMealDay } from '../db/index.ts'
import { sendMessage, stripCodeFences } from '../lib/anthropic.ts'
import { formatLongDate, toISODate } from '../lib/dates.ts'
import {
  mealSystemPrompt,
  splitLines,
  validateParsedMeal,
  weekTotals,
} from '../lib/meals.ts'
import { parseISODate, weekDates } from '../lib/program.ts'
import { useProgram } from '../program/useProgram.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { MealDay } from '../types/stores.ts'

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; text: string }

export function MealsScreen() {
  const { program, today, week } = useProgram()
  const { settings } = useSettings()
  const [date, setDate] = useState(() => toISODate(today))
  const [day, setDay] = useState<MealDay | null>(null)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [weekDays, setWeekDays] = useState<MealDay[]>([])

  const dates = useMemo(
    () => (program ? weekDates(program, week).map(toISODate) : []),
    [program, week],
  )

  useEffect(() => {
    let live = true
    void getMealDay(date).then((found) => {
      if (!live) return
      setDay(found ?? null)
      setText((found?.lines ?? []).join('\n'))
    })
    return () => {
      live = false
    }
  }, [date])

  useEffect(() => {
    if (dates.length === 0) return
    let live = true
    void Promise.all(dates.map((iso) => getMealDay(iso))).then((found) => {
      if (live) setWeekDays(found.filter((item): item is MealDay => !!item))
    })
    return () => {
      live = false
    }
  }, [dates, day])

  async function save(next: MealDay) {
    await saveMealDay(next)
    setDay(next)
  }

  async function parse() {
    const lines = splitLines(text)
    if (lines.length === 0) {
      setPhase({ kind: 'error', text: 'Write at least one line first.' })
      return
    }
    await save({ date, lines, parsed: day?.parsed, parsedAt: day?.parsedAt })
    setPhase({ kind: 'loading' })
    const result = await sendMessage(
      {
        apiKey: settings.apiKey ?? '',
        model: settings.model ?? '',
        maxTokens: 2048,
        system: mealSystemPrompt(settings.mealBaseline ?? ''),
        messages: [{ role: 'user', content: lines.join('\n') }],
      },
      60_000,
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
        text: 'The model did not return JSON. Try Parse again.',
      })
      return
    }
    const checked = validateParsedMeal(payload)
    if (!checked.ok) {
      setPhase({ kind: 'error', text: checked.errors.join(' · ') })
      return
    }
    // Re-parsing replaces the previous result outright.
    await save({
      date,
      lines,
      parsed: checked.parsed,
      parsedAt: new Date().toISOString(),
    })
    setPhase({ kind: 'idle' })
  }

  const totals = weekTotals(weekDays)

  return (
    <div className="page">
      <div className="page-head page-head--split">
        <h1 className="page-title">Meals</h1>
        <span className="page-head__aside">
          {formatLongDate(parseISODate(date))}
        </span>
      </div>

      <div className="log-cards">
        <div className="log-card">
          <div className="log-card__label">This day</div>
          <div className="log-card__value">
            {day?.parsed ? day.parsed.kcal.toLocaleString('en-US') : '—'}
            <span style={{ fontSize: 13, color: 'var(--muted)' }}> kcal</span>
          </div>
          <div className="log-card__label">
            {day?.parsed ? `${day.parsed.proteinG} g protein` : 'not parsed yet'}
          </div>
        </div>
        <div className="log-card">
          <div className="log-card__label">Week total</div>
          <div className="log-card__value">
            {totals.parsedDays > 0 ? totals.kcal.toLocaleString('en-US') : '—'}
            <span style={{ fontSize: 13, color: 'var(--muted)' }}> kcal</span>
          </div>
          <div className="log-card__label">
            {totals.parsedDays > 0
              ? `${totals.proteinG} g protein · ${totals.parsedDays} of 7 days`
              : 'no days parsed'}
          </div>
        </div>
      </div>

      <div className="form-card">
        <label className="field-label" htmlFor="meal-date">
          Day
        </label>
        <input
          id="meal-date"
          className="text-input"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <label className="field-label" htmlFor="meal-lines">
          Entry
        </label>
        <textarea
          id="meal-lines"
          className="textarea mono-block"
          placeholder={'DFS\nSWAP lunch: rice dal 120 g\nADD nut mix 25 g'}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => void save({ ...day, date, lines: splitLines(text) })}
        />
        <button
          type="button"
          className="btn-primary"
          style={{ height: 46, marginTop: 12, borderRadius: 12, fontSize: 15 }}
          disabled={phase.kind === 'loading'}
          onClick={() => void parse()}
        >
          {phase.kind === 'loading' ? 'Parsing…' : 'Parse'}
        </button>
      </div>

      {phase.kind === 'loading' && (
        <div className="state-panel" style={{ marginTop: 14 }}>
          <div className="spinner" />
          <div className="state-panel__title">Reading your lines</div>
          <div className="state-panel__body">
            Sending this day to your model. Usually a few seconds.
          </div>
        </div>
      )}
      {phase.kind === 'error' && (
        <div className="state-panel" style={{ marginTop: 14 }}>
          <div className="state-panel__title">Couldn&apos;t parse this day</div>
          <div className="state-panel__body">{phase.text}</div>
          <button type="button" className="btn-inline" onClick={() => void parse()}>
            Retry
          </button>
        </div>
      )}

      {day?.parsed && (
        <>
          <div className="section-label">Parsed · line by line</div>
          <div className="card--rows">
            {day.parsed.items.map((item, i) => (
              <div className="parsed-row" key={`${item.line}-${i}`}>
                <div className="parsed-row__line">{item.line}</div>
                <span className="parsed-row__value">
                  {item.kcal > 0 && i > 0 ? '+' : ''}
                  {item.kcal.toLocaleString('en-US')} · {item.proteinG > 0 && i > 0 ? '+' : ''}
                  {item.proteinG} g
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ height: 24 }} />
    </div>
  )
}
