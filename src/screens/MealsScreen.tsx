// Meals, frames 3n to 3p in the 1b layout (EXEC-10B task 7, D-032, D-049):
// the target calculated on the phone, lines matched to the user's own foods,
// and only unmatched lines sent (through the preview) or entered by hand.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { sendAndLog } from '../ai/send.ts'
import { usePreview } from '../ai/usePreview.tsx'
import { getGoals, getMealDay, saveMealDay } from '../db/index.ts'
import { stripCodeFences } from '../lib/anthropic.ts'
import { toISODate } from '../lib/dates.ts'
import { dayTotals, parseLocally, sourceOf, toMealDay } from '../lib/mealLocal.ts'
import { mealSystemPrompt, splitLines, validateParsedMeal } from '../lib/meals.ts'
import { buildPayload, type Payload } from '../lib/payload.ts'
import { parseISODate, weekDates } from '../lib/program.ts'
import { computeTargets } from '../lib/targets.ts'
import { PrimaryButton, SectionHead } from '../onboarding/ui.tsx'
import { useProgram } from '../program/useProgram.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { Goals, MealDay, MealSource, ParsedMealLine, PrivacyLevel } from '../types/stores.ts'

type SendState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; text: string }

const DAY = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const SOURCE_HEAD: Record<MealSource, string> = { phone: 'On phone', ai: 'From AI', manual: 'Entered by you' }

const n = (v: number) => Math.round(v).toLocaleString('en-US')

function Bar({ value, of }: { value: number; of: number }) {
  const pct = of > 0 ? Math.max(0, Math.min(100, (value / of) * 100)) : 0
  return (
    <div className="ml-bar">
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

function LineRow({ item }: { item: ParsedMealLine }) {
  return (
    <div className="ml-line">
      <div className="ml-line__text">{item.line}</div>
      <span className="bd-value" style={{ fontSize: 14 }}>
        {n(item.kcal)} kcal · {n(item.proteinG)} g
      </span>
    </div>
  )
}

export function MealsScreen() {
  const navigate = useNavigate()
  const { program, today, week } = useProgram()
  const { settings, update } = useSettings()
  const [date, setDate] = useState(() => toISODate(today))
  const [day, setDay] = useState<MealDay | null>(null)
  const [text, setText] = useState('')
  const [goals, setGoals] = useState<Goals | null>(null)
  const [weekDays, setWeekDays] = useState<MealDay[]>([])
  const [manual, setManual] = useState<Record<string, { kcal: string; proteinG: string }> | null>(null)
  const [send, setSend] = useState<SendState>({ kind: 'idle' })

  const foods = useMemo(() => settings.mealFoods ?? [], [settings.mealFoods])
  const dates = useMemo(() => (program ? weekDates(program, week).map(toISODate) : []), [program, week])

  useEffect(() => {
    let live = true
    void getGoals().then((g) => live && setGoals(g ?? null))
    return () => {
      live = false
    }
  }, [])

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

  const items = day?.parsed?.items ?? []
  const done = new Set(items.map((i) => i.line))
  const waiting = day?.parsed ? day.lines.filter((l) => !done.has(l)) : []

  async function save(next: MealDay) {
    await saveMealDay(next)
    setDay(next)
  }

  /** Parse on the phone; lines already resolved by AI or by hand keep their numbers. */
  async function parse() {
    const lines = splitLines(text)
    const { resolved } = parseLocally(lines, foods, items)
    setManual(null)
    setSend({ kind: 'idle' })
    await save(toMealDay(date, lines, resolved, new Date()))
  }

  async function resolve(added: ParsedMealLine[]) {
    if (!day) return
    const byLine = new Map([...items, ...added].map((i) => [i.line, i]))
    const ordered = day.lines.map((l) => byLine.get(l)).filter((i): i is ParsedMealLine => !!i)
    await save(toMealDay(date, day.lines, ordered, new Date()))
  }

  async function sendLines(payload: Payload, level: PrivacyLevel) {
    const lines = waiting
    setSend({ kind: 'sending' })
    const result = await sendAndLog({ kind: 'meals', level, payload, system: mealSystemPrompt(), settings, maxTokens: 2048, timeoutMs: 60_000 })
    if (!result.ok) {
      setSend({ kind: 'error', text: result.error })
      return
    }
    let reply: unknown
    try {
      reply = JSON.parse(stripCodeFences(result.text))
    } catch {
      setSend({ kind: 'error', text: 'The model did not return JSON.' })
      return
    }
    const checked = validateParsedMeal(reply)
    if (!checked.ok) {
      setSend({ kind: 'error', text: checked.errors.join(' · ') })
      return
    }
    // Each returned line is stored with source 'ai'; lines it missed keep waiting.
    const added = checked.parsed.items
      .filter((i) => lines.includes(i.line))
      .map((i) => ({ line: i.line, kcal: i.kcal, proteinG: i.proteinG, source: 'ai' as const }))
    await resolve(added)
    setSend({ kind: 'idle' })
  }

  // D-049 rule 3: the preview shows only the waiting lines, the foods and the notes.
  const preview = usePreview({
    kind: 'meals',
    settings,
    build: (level, includeNotes) =>
      buildPayload('meals', level, includeNotes, { mealLines: waiting, mealFoods: foods, mealBaseline: settings.mealBaseline ?? '' }),
    onLevel: (privacyLevel) => void update({ privacyLevel }),
    onSend: (payload, level) => void sendLines(payload, level),
  })

  if (preview.picking) return <>{preview.element}</>

  const targets = computeTargets(goals)
  const eaten = dayTotals(items)
  const saved = weekDays.filter((d) => d.parsed)
  const avg = saved.length
    ? { kcal: saved.reduce((s, d) => s + (d.parsed?.kcal ?? 0), 0) / saved.length, proteinG: saved.reduce((s, d) => s + (d.parsed?.proteinG ?? 0), 0) / saved.length }
    : null
  const bySource = (['phone', 'ai', 'manual'] as MealSource[])
    .map((source) => ({ source, lines: items.filter((i) => sourceOf(i) === source) }))
    .filter((g) => g.lines.length > 0)

  return (
    <div className="tl" style={{ paddingBottom: 24 }}>
      {preview.element}
      <div className="ml-head">
        <h1 className="lg-title">Meals</h1>
        <label className="ml-date">
          {DAY.format(parseISODate(date))}
          <input type="date" aria-label="Day" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>

      {/* 3n: today's target, calculated on this phone and never sent (D-046). */}
      <div className="ml-target">
        <div className="ml-target__head">
          <span>Today&apos;s target</span>
          <span className="ml-target__aside">Calculated on this phone</span>
        </div>
        {targets.kcal !== undefined && (
          <>
            <div className="ml-big">
              <span className="ml-big__value">{n(eaten.kcal)}</span>
              <span className="ml-big__of">of {n(targets.kcal)} kcal</span>
            </div>
            <Bar value={eaten.kcal} of={targets.kcal} />
          </>
        )}
        {targets.proteinG !== undefined && (
          <>
            <div className="ml-big ml-big--small">
              <span className="ml-big__value">{n(eaten.proteinG)}</span>
              <span className="ml-big__of">of {targets.proteinG} g protein</span>
            </div>
            <Bar value={eaten.proteinG} of={targets.proteinG} />
          </>
        )}
        {targets.kcal !== undefined && targets.floorApplied && (
          <div className="ml-note ml-note--warn">Set to a safe minimum for your goal and timeframe.</div>
        )}
        {targets.kcal !== undefined && !targets.floorApplied && (
          <div className="ml-note">An estimate from a standard formula. It can be off by 10% or more for some people; adjust by how your weight actually moves.</div>
        )}
        {targets.kcal === undefined && targets.proteinG !== undefined && (
          <Link className="ml-note ml-note--link" to="/goal">
            Add height, age, sex and activity in Goal for a calorie target.
          </Link>
        )}
        {targets.proteinG === undefined && (
          <Link className="ml-note ml-note--link" to="/goal">
            Add your weight in Goal to see a target.
          </Link>
        )}
      </div>

      <div style={{ margin: '0 24px' }}>
        <SectionHead>Today&apos;s entry</SectionHead>
        <textarea
          className="ml-entry"
          aria-label="Today's entry"
          placeholder={'BASE breakfast\nBASE lunch\nADD protein bar 1'}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => void save({ ...(day ?? {}), date, lines: splitLines(text) })}
        />
        <div style={{ marginTop: 12 }}>
          <PrimaryButton onClick={() => void parse()}>Parse</PrimaryButton>
        </div>

        {/* 3o: counted lines, by where their numbers came from. */}
        {bySource.map((group) => (
          <div key={group.source}>
            <SectionHead aside={`${group.lines.length} ${group.lines.length === 1 ? 'line' : 'lines'}`}>{SOURCE_HEAD[group.source]}</SectionHead>
            {group.lines.map((item, i) => (
              <LineRow item={item} key={`${item.line}-${i}`} />
            ))}
          </div>
        ))}

        {waiting.length > 0 && (
          <>
            <SectionHead aside={`${waiting.length} ${waiting.length === 1 ? 'line' : 'lines'}`}>Needs AI</SectionHead>
            {waiting.map((line) => (
              <div key={line}>
                <div className="ml-line">
                  <div>
                    <div className="ml-line__text">{line}</div>
                    <div className="ml-line__sub">{manual ? 'Enter it yourself' : 'Not in your baseline'}</div>
                  </div>
                  {!manual && <span className="ml-waiting">Not counted yet</span>}
                </div>
                {manual && (
                  <div className="bd-cols" style={{ marginTop: 12 }}>
                    <div>
                      <div className="bd-label">Calories</div>
                      <div className="bd-input">
                        <input
                          inputMode="decimal"
                          aria-label={`Calories for ${line}`}
                          value={manual[line]?.kcal ?? ''}
                          onChange={(e) => setManual((m) => ({ ...m, [line]: { kcal: e.target.value, proteinG: m?.[line]?.proteinG ?? '' } }))}
                        />
                        <span className="bd-input__unit">kcal</span>
                      </div>
                    </div>
                    <div>
                      <div className="bd-label">Protein</div>
                      <div className="bd-input">
                        <input
                          inputMode="decimal"
                          placeholder="Optional"
                          aria-label={`Protein for ${line}`}
                          value={manual[line]?.proteinG ?? ''}
                          onChange={(e) => setManual((m) => ({ ...m, [line]: { kcal: m?.[line]?.kcal ?? '', proteinG: e.target.value } }))}
                        />
                        <span className="bd-input__unit">g</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {manual ? (
              <div className="ai-banner__actions">
                <button
                  type="button"
                  className="ai-btn ai-btn--primary"
                  onClick={() => {
                    // 3p: saved with source 'manual'; blank calories leave a line waiting.
                    const added = waiting
                      .map((line) => ({ line, kcal: Number((manual[line]?.kcal ?? '').replace(',', '.')), proteinG: Number((manual[line]?.proteinG ?? '').replace(',', '.')) || 0 }))
                      .filter((i) => (manual[i.line]?.kcal ?? '').trim() !== '' && Number.isFinite(i.kcal))
                      .map((i) => ({ ...i, source: 'manual' as const }))
                    void resolve(added).then(() => setManual(null))
                  }}
                >
                  Save
                </button>
                <button type="button" className="ai-btn" onClick={() => setManual(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="ai-banner__actions">
                  <button type="button" className="ai-btn ai-btn--primary" disabled={send.kind === 'sending'} onClick={() => preview.open()}>
                    {send.kind === 'sending' ? 'Sending…' : 'Send these lines'}
                  </button>
                  <button type="button" className="ai-btn" onClick={() => setManual({})}>
                    Enter kcal myself
                  </button>
                </div>
                <div className="ml-note" style={{ marginTop: 8 }}>
                  Send shows exactly what goes to Anthropic first.
                </div>
              </>
            )}
            {send.kind === 'error' && (
              <div className="ml-error" role="alert">
                <div className="ml-error__title">Couldn&apos;t reach the model</div>
                <div className="ml-note" style={{ marginTop: 4 }}>
                  Check your key in Settings. Your line is kept.
                </div>
                <div className="ai-banner__actions" style={{ marginTop: 10 }}>
                  <button type="button" className="ai-btn" onClick={() => navigate('/settings')}>
                    Open Settings
                  </button>
                  <button type="button" className="ai-btn" onClick={() => preview.open()}>
                    Retry
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <SectionHead>Totals</SectionHead>
        <div className="ml-total">
          <span className="ml-total__label">Today</span>
          <span className="ml-total__value">
            {targets.kcal !== undefined ? `${n(eaten.kcal)} of ${n(targets.kcal)} kcal` : `${n(eaten.kcal)} kcal`} ·{' '}
            {targets.proteinG !== undefined ? `${n(eaten.proteinG)} of ${targets.proteinG} g` : `${n(eaten.proteinG)} g`}
          </span>
        </div>
        <div className="ml-total">
          <span className="ml-total__label">This week, daily average</span>
          <span className="ml-total__value">{avg ? `${n(avg.kcal)} kcal · ${n(avg.proteinG)} g` : 'No saved days yet'}</span>
        </div>
        {waiting.length > 0 && (
          <div className="ml-note" style={{ marginTop: 8 }}>
            {waiting.length === 1 ? 'Today excludes the line still waiting.' : 'Today excludes the lines still waiting.'}
          </div>
        )}
      </div>
    </div>
  )
}
