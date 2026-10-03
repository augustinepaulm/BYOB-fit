// Meals in the v3 design (frames 3.01 to 3.05, 4.06, 4.10; D-032, D-049,
// D-079): a friendly list of foods by meal, counted on the phone where the
// user's own foods match (the D-049 line grammar still parses), the rest
// estimated through the send preview or entered by hand; the day's totals
// against the targets and the limits of docs/SCORES.md Part 4.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { sendAndLog } from '../ai/send.ts'
import { useOnline, usePreview } from '../ai/usePreview.tsx'
import { Sheet } from '../builder/ui.tsx'
import { getGoals, getMealDay, listBodyEntries, saveMealDay } from '../db/index.ts'
import { stripCodeFences } from '../lib/anthropic.ts'
import { formatShortDate, formatTrainContext, toISODate } from '../lib/dates.ts'
import { aiEstimated, dayTotals, foodForLine, mealOfLine, parseLocally, sourceOf, toMealDay } from '../lib/mealLocal.ts'
import { mealSystemPrompt, validateParsedMeal } from '../lib/meals.ts'
import {
  ADDED_SUGAR_LIMIT_PER_MEAL_G,
  MEAL_NAMES,
  SAT_FAT_LIMIT_PCT,
  SODIUM_LIMIT_MG,
  addedSugars,
  energyBand,
  fibreTarget,
  rangeOf,
  satFatOver,
  satFatPct,
  sodiumOver,
} from '../lib/nutrients.ts'
import { buildPayload, type Payload } from '../lib/payload.ts'
import { weekDates } from '../lib/program.ts'
import { computeTargets } from '../lib/targets.ts'
import { useProgram } from '../program/useProgram.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { BodyEntry, Goals, MealDay, MealFood, MealLabel, ParsedMealLine, PrivacyLevel } from '../types/stores.ts'
import { AppHeader } from '../ui/shell.tsx'

/** Sunday to Saturday around `today`, for the week average without a program. */
function plainWeek(today: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + i))
}

type SendState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; text: string }

const MEALS: MealLabel[] = ['breakfast', 'lunch', 'dinner', 'snack']
const n = (v: number) => Math.round(v).toLocaleString('en-US')
const g1 = (v: number) => (Math.abs(v) >= 10 ? n(v) : String(Math.round(v * 10) / 10))

export function AiTag() {
  return <span className="ai-tag">AI estimate</span>
}

/** A bar scaled so a target or limit sits at a fixed point, with an optional band or tick (3.03). */
function Meter({ value, max, band, tick, tone = 'sage' }: { value: number; max: number; band?: { low: number; high: number }; tick?: number; tone?: 'sage' | 'soft' | 'warn' }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`
  return (
    <div className="meter" aria-hidden="true">
      {band && <span className="meter__band" style={{ left: pct(band.low), width: `calc(${pct(band.high)} - ${pct(band.low)})` }} />}
      <span className={`meter__fill meter__fill--${tone}`} style={{ width: pct(value) }} />
      {tick !== undefined && <span className="meter__tick" style={{ left: pct(tick) }} />}
    </div>
  )
}

function MeterRow({ label, value, of, ai }: { label: string; value: string; of: string; ai?: boolean }) {
  return (
    <div className="meter-row__head">
      <span className="meter-row__label">
        {label} {ai && <AiTag />}
      </span>
      <span className="meter-row__of">
        <b>{value}</b> {of}
      </span>
    </div>
  )
}

/** One food line (3.03): name, where its numbers came from, calories and protein. */
function FoodRow({ item, waiting, line, food, onOpen }: { item?: ParsedMealLine; waiting: boolean; line: string; food?: MealFood; onOpen: () => void }) {
  const source = item ? sourceOf(item) : null
  const sub = waiting ? 'Waiting for estimate' : source === 'phone' ? (food && food.name.toLowerCase() !== line.toLowerCase() ? `${food.name} · saved` : 'Saved') : source === 'manual' ? 'Entered by you' : ''
  return (
    <button type="button" className="food-row" onClick={onOpen}>
      <span className="food-row__text">
        <span className="food-row__name">
          <span className={waiting ? 'food-row__title food-row__title--waiting' : 'food-row__title'}>{line}</span>
          {source === 'ai' && <AiTag />}
        </span>
        {sub && <span className="food-row__sub">{sub}</span>}
      </span>
      {item && (
        <span className="food-row__nums">
          <span className="food-row__kcal">{n(item.kcal)}</span>
          <span className="food-row__protein">{n(item.proteinG)} g protein</span>
        </span>
      )}
    </button>
  )
}

/** The add-a-food box with suggestions from saved foods (3.02, 4.10). */
function AddFood({ foods, onAdd, onClose, autoFocus }: { foods: MealFood[]; onAdd: (line: string) => void; onClose?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const query = text.trim().toLowerCase()
  const matches = query === '' ? [] : foods.filter((f) => f.name.toLowerCase().includes(query.replace(/^(base|add|skip) /, ''))).slice(0, 4)
  const exact = matches.some((f) => f.name.toLowerCase() === query)
  const add = (line: string) => {
    if (line.trim() === '') return
    onAdd(line.trim())
    setText('')
  }
  return (
    <div className="add-food">
      <input
        className="add-food__input"
        type="text"
        enterKeyHint="done"
        autoFocus={autoFocus}
        aria-label="Add a food"
        placeholder="Add a food, like rice 150 g"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add(text)
          }
          if (event.key === 'Escape') onClose?.()
        }}
      />
      {matches.map((food) => (
        <button key={food.name} type="button" className="suggest suggest--saved" onClick={() => add(food.name)}>
          <span className="suggest__text">
            <span className="suggest__title">{food.name}</span>
            <span className="suggest__sub">Saved{food.proteinG !== undefined ? ` · ${food.proteinG} g protein` : ''}</span>
          </span>
          <span className="suggest__kcal">{n(food.kcal)}</span>
        </button>
      ))}
      {query !== '' && !exact && (
        <button type="button" className={matches.length ? 'suggest' : 'suggest suggest--saved'} onClick={() => add(text)}>
          <span className="suggest__text">
            <span className="suggest__title">{text.trim()}</span>
            <span className="suggest__sub">{matchesGrammar(text, foods) ? 'From your foods' : 'Not in your foods · can be estimated'}</span>
          </span>
        </button>
      )}
    </div>
  )
}

function matchesGrammar(line: string, foods: MealFood[]): boolean {
  return parseLocally([line], foods).resolved.length > 0
}

export function MealsScreen() {
  const navigate = useNavigate()
  const { program, today, week } = useProgram()
  const { settings, update } = useSettings()
  const todayIso = toISODate(today)
  const [date, setDate] = useState(todayIso)
  const [day, setDay] = useState<MealDay | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [goals, setGoals] = useState<Goals | null>(null)
  const [bodyEntries, setBodyEntries] = useState<BodyEntry[]>([])
  const [weekDays, setWeekDays] = useState<MealDay[]>([])
  const [adding, setAdding] = useState<MealLabel | 'none' | null>(null)
  const [openLine, setOpenLine] = useState<number | null>(null)
  const [manual, setManual] = useState<{ kcal: string; proteinG: string }>({ kcal: '', proteinG: '' })
  const [send, setSend] = useState<SendState>({ kind: 'idle' })
  const [floorWhy, setFloorWhy] = useState(false)

  const foods = useMemo(() => settings.mealFoods ?? [], [settings.mealFoods])
  const dates = useMemo(() => (program ? weekDates(program, week) : plainWeek(today)).map(toISODate), [program, week, today])
  const online = useOnline()

  useEffect(() => {
    let live = true
    void Promise.all([getGoals(), listBodyEntries()]).then(([g, b]) => {
      if (!live) return
      setGoals(g ?? null)
      setBodyEntries(b)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    let live = true
    void getMealDay(date).then((found) => {
      if (!live) return
      setDay(found ?? null)
      setLoaded(true)
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

  const lines = useMemo(() => day?.lines ?? [], [day])
  const items = useMemo(() => day?.parsed?.items ?? [], [day])
  const resultFor = (line: string) => items.find((i) => i.line === line)
  const waiting = lines.filter((l) => !resultFor(l))

  /** Store lines and labels, matching on the phone; results from AI or by hand are kept. */
  async function store(nextLines: string[], nextMeals: (MealLabel | null)[], added: ParsedMealLine[] = []) {
    const previous = [...items.filter((i) => !added.some((a) => a.line === i.line)), ...added]
    const { resolved } = parseLocally(nextLines, foods, previous)
    const next = toMealDay(date, nextLines, resolved, new Date(), nextMeals)
    await saveMealDay(next)
    setDay(next)
  }

  const mealsOf = (): (MealLabel | null)[] => lines.map((_, i) => (day ? mealOfLine(day, i) : null))

  async function addLine(line: string, meal: MealLabel | null) {
    await store([...lines, line], [...mealsOf(), meal])
  }

  async function removeLine(index: number) {
    await store(
      lines.filter((_, i) => i !== index),
      mealsOf().filter((_, i) => i !== index),
    )
  }

  async function moveLine(index: number, meal: MealLabel | null) {
    const meals = mealsOf()
    meals[index] = meal
    await store(lines, meals)
  }

  async function sendLines(payload: Payload, level: PrivacyLevel) {
    const asked = waiting
    setSend({ kind: 'sending' })
    const result = await sendAndLog({ kind: 'meals', level, payload, system: mealSystemPrompt(), settings, maxTokens: 4096, timeoutMs: 60_000 })
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
    const added = checked.parsed.items.filter((i) => asked.includes(i.line)).map((i) => ({ ...i, source: 'ai' as const }))
    await store(lines, mealsOf(), added)
    setSend({ kind: 'idle' })
  }

  // D-049 rule 3: the preview shows only the waiting lines, the foods and the notes.
  const preview = usePreview({
    kind: 'meals',
    settings,
    build: (level, includeNotes) => buildPayload('meals', level, includeNotes, { mealLines: waiting, mealFoods: foods, mealBaseline: settings.mealBaseline ?? '' }),
    onLevel: (privacyLevel) => void update({ privacyLevel }),
    onSend: (payload, level) => void sendLines(payload, level),
  })

  if (preview.picking) return <>{preview.element}</>
  if (!loaded) return null

  // D-078 rule 3: an entered BMR no more than 8 weeks old is the resting energy.
  const targets = computeTargets(goals, bodyEntries, todayIso)
  const fibre = fibreTarget(targets.kcal, goals?.currentStats)
  const eaten = dayTotals(items)
  const isToday = date === todayIso
  const context = program ? formatTrainContext(today, week) : undefined
  const dateChip = (
    <label className="hdr-chip">
      {isToday ? 'Today' : formatShortDate(date)}
      <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
        <path d="M1 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <input type="date" aria-label="Day" value={date} max={todayIso} onChange={(e) => e.target.value && setDate(e.target.value)} />
    </label>
  )
  const saved = weekDays.filter((d) => d.parsed)
  const avg = saved.length ? { kcal: saved.reduce((s, d) => s + (d.parsed?.kcal ?? 0), 0) / saved.length, proteinG: saved.reduce((s, d) => s + (d.parsed?.proteinG ?? 0), 0) / saved.length } : null
  const lineMeal = (item: ParsedMealLine) => {
    const index = lines.indexOf(item.line)
    return index >= 0 && day ? mealOfLine(day, index) : null
  }
  const sugars = addedSugars(items, lineMeal)
  const floorCard = targets.kcal !== undefined && targets.floorApplied && (
    <section className="card-v3 card-v3--warn">
      <h2 className="card-v3__warn-title">Your target is at the safety floor</h2>
      <p className="card-v3__warn-body">
        Your goal points lower, but the target stays at the floor so you keep eating enough to train and recover. Slower progress from here is the safer path.
      </p>
      {floorWhy && (
        <p className="card-v3__warn-body">
          The app never sets a calorie target below {n(targets.floor ?? 0)} kcal a day for you. Below that it is hard to get enough protein and energy to train, and losses come more from muscle.
        </p>
      )}
      <button type="button" className="btn btn--tertiary card-v3__warn-link" aria-expanded={floorWhy} onClick={() => setFloorWhy((v) => !v)}>
        Why there is a floor
      </button>
    </section>
  )

  const errorCard = send.kind === 'error' && (
    <section className="card-v3 card-v3--danger" role="alert">
      <h2 className="card-v3__danger-title">The estimate didn&apos;t come back</h2>
      <p className="card-v3__warn-body">
        {/401|authentication|x-api-key/i.test(send.text) ? 'Your provider said the key isn’t valid.' : send.text.replace(/\.?$/, '.')} Your foods are still here.
      </p>
      <div className="card-v3__buttons">
        <button type="button" className="chip" onClick={() => navigate('/settings/ai')}>
          Check key in Settings
        </button>
        <button type="button" className="chip" onClick={() => preview.open()}>
          Try again
        </button>
      </div>
    </section>
  )

  // 3.01: nothing logged yet.
  if (lines.length === 0) {
    return (
      <div className="screen">
        {preview.element}
        <AppHeader context={context} title="Meals" action={dateChip} />
        {floorCard}
        <section className="card-v3">
          <h2 className="meals-ask">What have you eaten {isToday ? 'today' : 'this day'}?</h2>
          <p className="page-v3__lead">One food per line. A saved food fills in from one word.</p>
          <AddFood foods={foods} onAdd={(line) => void addLine(line, null)} />
          {foods.length > 0 ? (
            <>
              <h3 className="lgroup__title meals-saved__head">Saved foods</h3>
              <div className="chips-v3">
                {foods.map((food) => (
                  <button key={food.name} type="button" className="chip" onClick={() => void addLine(food.name, null)}>
                    {food.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button type="button" className="btn btn--tertiary meals-saved__setup" onClick={() => navigate('/settings/foods')}>
              Save your usual foods
            </button>
          )}
        </section>
        <section className="card-v3 targets-v3">
          <div>
            <b>{targets.kcal !== undefined ? n(targets.kcal) : '–'}</b>
            <span>kcal target</span>
          </div>
          <div>
            <b>{targets.proteinG !== undefined ? `${targets.proteinG} g` : '–'}</b>
            <span>protein target</span>
          </div>
          <div>
            <b>{fibre !== undefined ? `${fibre} g` : '–'}</b>
            <span>fibre target</span>
          </div>
        </section>
        <TargetNotes targets={targets} fibre={fibre} onGoal={() => navigate('/goal')} />
      </div>
    )
  }

  const band = targets.kcal !== undefined ? energyBand(targets.kcal, targets.floor ?? 0) : undefined
  const range = band ? rangeOf(eaten.kcal, band) : undefined
  const satPct = eaten.satFatG !== undefined ? satFatPct(eaten.satFatG, eaten.kcal) : undefined
  const groups: { meal: MealLabel | null; indexes: number[] }[] = [
    ...MEALS.map((meal) => ({ meal: meal as MealLabel | null, indexes: lines.map((_, i) => i).filter((i) => day && mealOfLine(day, i) === meal) })),
    { meal: null, indexes: lines.map((_, i) => i).filter((i) => day && mealOfLine(day, i) === null) },
  ]
  const open = openLine !== null ? { index: openLine, line: lines[openLine], item: resultFor(lines[openLine]) } : null

  return (
    <div className="screen">
      {preview.element}
      <AppHeader context={context} title="Meals" action={dateChip} />
      {errorCard}
      {floorCard}

      <section className="card-v3 totals-v3">
        <div className="totals-v3__top">
          <div>
            <div className="usage-card__label">Calories {isToday ? 'today' : 'this day'}</div>
            <div className="usage-card__amount">
              <span className="totals-v3__kcal">{n(eaten.kcal)}</span>
              {targets.kcal !== undefined && (
                <span className="usage-card__of">
                  of {n(targets.kcal)}
                  {targets.floorApplied ? ' (floor)' : ''}
                </span>
              )}
            </div>
          </div>
          {range && <span className="totals-v3__range">{range === 'below' ? 'Below your range' : range === 'above' ? 'Above your range' : 'In your range'}</span>}
        </div>
        {targets.kcal !== undefined && band && <Meter value={eaten.kcal} max={targets.kcal * 1.25} band={band} />}
        <div className="totals-v3__rows">
          <div>
            <MeterRow label="Protein" value={`${n(eaten.proteinG)} g`} of={targets.proteinG !== undefined ? `of ${targets.proteinG} g` : ''} ai={aiEstimated(items, 'proteinG')} />
            {targets.proteinG !== undefined && <Meter value={eaten.proteinG} max={targets.proteinG} />}
          </div>
          <div>
            <MeterRow label="Fibre" value={eaten.fibreG !== undefined ? `${g1(eaten.fibreG)} g` : 'Not known'} of={fibre !== undefined ? `of ${fibre} g` : ''} ai={aiEstimated(items, 'fibreG')} />
            {fibre !== undefined && <Meter value={eaten.fibreG ?? 0} max={fibre} />}
          </div>
          <div className="totals-v3__pair">
            <div className="totals-v3__tile">
              <span>
                Carbohydrate {aiEstimated(items, 'carbsG') && <AiTag />}
              </span>
              <b>{eaten.carbsG !== undefined ? `${n(eaten.carbsG)} g` : '–'}</b>
            </div>
            <div className="totals-v3__tile">
              <span>
                Fat {aiEstimated(items, 'fatG') && <AiTag />}
              </span>
              <b>{eaten.fatG !== undefined ? `${n(eaten.fatG)} g` : '–'}</b>
            </div>
          </div>
        </div>
        <div className="totals-v3__limits">
          <h3 className="lgroup__title">Limits</h3>
          <div>
            <MeterRow label="Sodium" value={eaten.sodiumMg !== undefined ? `${n(eaten.sodiumMg)} mg` : 'Not known'} of={`limit ${n(SODIUM_LIMIT_MG)}`} ai={aiEstimated(items, 'sodiumMg')} />
            <Meter value={eaten.sodiumMg ?? 0} max={SODIUM_LIMIT_MG * 1.15} tick={SODIUM_LIMIT_MG} tone={eaten.sodiumMg !== undefined && sodiumOver(eaten.sodiumMg) ? 'warn' : 'soft'} />
            {eaten.sodiumMg !== undefined && sodiumOver(eaten.sodiumMg) && <p className="totals-v3__note">Highly active people may need more to replace sweat losses.</p>}
          </div>
          <div>
            <MeterRow
              label="Saturated fat"
              value={eaten.satFatG !== undefined ? `${g1(eaten.satFatG)} g` : 'Not known'}
              of={satPct !== undefined ? `${satPct}% of calories, ${satFatOver(satPct) ? 'over' : 'under'} the ${SAT_FAT_LIMIT_PCT}% limit` : `limit ${SAT_FAT_LIMIT_PCT}% of calories`}
              ai={aiEstimated(items, 'satFatG')}
            />
            <Meter value={satPct ?? 0} max={SAT_FAT_LIMIT_PCT * 1.15} tick={SAT_FAT_LIMIT_PCT} tone={satPct !== undefined && satFatOver(satPct) ? 'warn' : 'soft'} />
          </div>
          {sugars.meals.map((meal) => (
            <div key={meal.meal}>
              <MeterRow label={`Added sugars, ${MEAL_NAMES[meal.meal].toLowerCase()}`} value={`${g1(meal.addedSugarG)} g`} of={`limit ${ADDED_SUGAR_LIMIT_PER_MEAL_G} per meal`} ai={items.some((i) => lineMeal(i) === meal.meal && sourceOf(i) === 'ai' && i.addedSugarG !== undefined)} />
              <Meter value={meal.addedSugarG} max={ADDED_SUGAR_LIMIT_PER_MEAL_G * 1.15} tick={ADDED_SUGAR_LIMIT_PER_MEAL_G} tone={meal.over ? 'warn' : 'soft'} />
            </div>
          ))}
          {sugars.unlabelledG !== undefined && (
            <MeterRow label="Added sugars, not in a meal" value={`${g1(sugars.unlabelledG)} g`} of="the limit is per meal" />
          )}
        </div>
      </section>

      {groups.map(({ meal, indexes }) => {
        if (meal === null && indexes.length === 0 && adding !== 'none') return null
        const sugar = meal ? sugars.meals.find((m) => m.meal === meal) : undefined
        const key = meal ?? 'none'
        return (
          <section className="lgroup" key={key}>
            <div className="lgroup__head">
              <h2 className="lgroup__title">{meal ? MEAL_NAMES[meal] : 'Not in a meal'}</h2>
              {sugar && (
                <span className="lgroup__aside">
                  Added sugars {g1(sugar.addedSugarG)} of {ADDED_SUGAR_LIMIT_PER_MEAL_G} g
                </span>
              )}
            </div>
            <div className="lgroup__card">
              {indexes.map((index) => (
                <FoodRow
                  key={`${index}-${lines[index]}`}
                  line={lines[index]}
                  item={resultFor(lines[index])}
                  food={foodForLine(lines[index], foods)}
                  waiting={!resultFor(lines[index])}
                  onOpen={() => {
                    setManual({ kcal: '', proteinG: '' })
                    setOpenLine(index)
                  }}
                />
              ))}
              {adding === key ? (
                <div className="add-food__wrap">
                  <AddFood autoFocus foods={foods} onAdd={(line) => void addLine(line, meal)} onClose={() => setAdding(null)} />
                  <button type="button" className="btn btn--tertiary" onClick={() => setAdding(null)}>
                    Done
                  </button>
                </div>
              ) : (
                <button type="button" className="meal-add" onClick={() => setAdding(key)}>
                  <span aria-hidden="true">+</span>Add a food
                </button>
              )}
            </div>
          </section>
        )
      })}

      {waiting.length > 0 && (
        <div className="actions-v3">
          {online ? (
            <>
              <button type="button" className="btn btn--primary" disabled={send.kind === 'sending'} onClick={() => preview.open()}>
                {send.kind === 'sending' ? 'Estimating…' : `Estimate ${waiting.length} ${waiting.length === 1 ? 'food' : 'foods'} with AI`}
              </button>
              <p className="note-v3">You see exactly what is sent first. Or tap a food to enter it yourself.</p>
            </>
          ) : (
            <p className="note-v3" role="status">
              You&apos;re offline. Tap a food to enter it yourself, or estimate when you&apos;re back online. Nothing is lost.
            </p>
          )}
          <p className="note-v3">{waiting.length === 1 ? 'The total leaves out the food still waiting.' : 'The total leaves out the foods still waiting.'}</p>
        </div>
      )}

      <section className="lgroup">
        <div className="lgroup__card">
          <div className="lrow">
            <span className="lrow__text">
              <span className="lrow__title">This week, daily average</span>
            </span>
            <span className="lrow__value">{avg ? `${n(avg.kcal)} kcal · ${n(avg.proteinG)} g` : 'No saved days yet'}</span>
          </div>
        </div>
      </section>
      <TargetNotes targets={targets} fibre={fibre} onGoal={() => navigate('/goal')} />

      {open && (
        <Sheet title={open.line} body={open.item ? (sourceOf(open.item) === 'ai' ? 'AI estimate' : sourceOf(open.item) === 'manual' ? 'Entered by you' : 'Counted from your saved foods') : 'Not counted yet'} onClose={() => setOpenLine(null)}>
          <div className="lgroup__title">Meal</div>
          <div className="chips-v3 chips-v3--sheet">
            {[...MEALS, null].map((meal) => {
              const on = day ? mealOfLine(day, open.index) === meal : meal === null
              return (
                <button
                  key={meal ?? 'none'}
                  type="button"
                  className={on ? 'chip chip--on' : 'chip'}
                  aria-pressed={on}
                  onClick={() => void moveLine(open.index, meal)}
                >
                  {meal ? MEAL_NAMES[meal] : 'No meal'}
                </button>
              )
            })}
          </div>
          {!open.item && (
            <>
              <div className="lgroup__title" style={{ marginTop: 16 }}>
                Enter it yourself
              </div>
              <div className="pair-v3" style={{ marginTop: 8 }}>
                <label className="field-v3">
                  <span className="field-v3__label">Calories</span>
                  <span className="field-v3__box">
                    <input inputMode="decimal" aria-label={`Calories for ${open.line}`} value={manual.kcal} onChange={(e) => setManual({ ...manual, kcal: e.target.value })} />
                    <span className="field-v3__unit">kcal</span>
                  </span>
                </label>
                <label className="field-v3">
                  <span className="field-v3__label">Protein</span>
                  <span className="field-v3__box">
                    <input inputMode="decimal" placeholder="Optional" aria-label={`Protein for ${open.line}`} value={manual.proteinG} onChange={(e) => setManual({ ...manual, proteinG: e.target.value })} />
                    <span className="field-v3__unit">g</span>
                  </span>
                </label>
              </div>
              <button
                type="button"
                className="btn btn--primary"
                style={{ marginTop: 12 }}
                disabled={manual.kcal.trim() === '' || !Number.isFinite(Number(manual.kcal.replace(',', '.')))}
                onClick={() => {
                  // 3p: saved with source 'manual'.
                  const kcal = Number(manual.kcal.replace(',', '.'))
                  const proteinG = Number(manual.proteinG.replace(',', '.')) || 0
                  void store(lines, mealsOf(), [{ line: open.line, kcal, proteinG, source: 'manual' }]).then(() => setOpenLine(null))
                }}
              >
                Save
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn--destructive-text"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => void removeLine(open.index).then(() => setOpenLine(null))}
          >
            Remove this food
          </button>
        </Sheet>
      )}
    </div>
  )
}

/** What the target is built from, and what is missing (D-046, D-078 rule 3). */
function TargetNotes({ targets, fibre, onGoal }: { targets: ReturnType<typeof computeTargets>; fibre: number | undefined; onGoal: () => void }) {
  return (
    <div className="target-notes">
      {targets.kcal !== undefined && !targets.floorApplied && (
        <p className="note-v3">An estimate from a standard formula. It can be off by 10% or more for some people; adjust by how your weight actually moves.</p>
      )}
      {targets.resting && (
        <p className="note-v3">
          {targets.resting.source === 'bmr'
            ? `Resting energy from your BMR entry of ${formatShortDate(targets.resting.date)}.`
            : 'Resting energy from your height, age and sex (Mifflin-St Jeor).'}
        </p>
      )}
      {targets.kcal !== undefined && fibre !== undefined && <p className="note-v3">Fibre target: 14 g per 1,000 kcal of your calorie target.</p>}
      {targets.kcal === undefined && targets.proteinG !== undefined && (
        <button type="button" className="btn btn--tertiary" onClick={onGoal}>
          Add height, age, sex and activity in Goal for a calorie target.
        </button>
      )}
      {targets.proteinG === undefined && (
        <button type="button" className="btn btn--tertiary" onClick={onGoal}>
          Add your weight in Goal to see a target.
        </button>
      )}
    </div>
  )
}
