// Frames 3.16 (AI key and model) and 3.17 (AI usage and budget), D-083,
// with D-084 rule 1's level names and D-085's usage and budget.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Sheet, Switch } from '../builder/ui.tsx'
import { listSentLog } from '../db/index.ts'
import { DEFAULT_MODEL, testKey } from '../lib/anthropic.ts'
import { formatDayDate, formatShortDate, toISODate } from '../lib/dates.ts'
import { PRIVACY_LEVELS } from '../lib/payload.ts'
import {
  CONSOLE_LIMITS_URL,
  DEFAULT_PRICES,
  DEFAULT_WARN_PCT,
  MODEL_NAMES,
  budgetOf,
  budgetState,
  entryCost,
  formatUsd,
  monthUsage,
  pricesOf,
} from '../lib/usage.ts'
import { privacyLevelOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { ModelPrice, SentLogEntry } from '../types/stores.ts'
import { AppHeader, ListGroup, ListRow } from '../ui/shell.tsx'
import { KEY_HELP_URL } from './SettingsScreen.tsx'

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long' })

function modelName(model: string): string {
  return MODEL_NAMES[model] ?? model
}

function Check({ on }: { on: boolean }) {
  return (
    <span className={on ? 'radio-v3 radio-v3--on' : 'radio-v3'} aria-hidden="true">
      {on && (
        <svg width="12" height="12" viewBox="0 0 14 14">
          <path d="M3 7.5l2.5 2.5L11 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

/** Frame 3.16. */
export function AiSettingsScreen() {
  const navigate = useNavigate()
  const { settings, loading, update } = useSettings()
  const [editingKey, setEditingKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [picking, setPicking] = useState(false)
  const [customModel, setCustomModel] = useState('')
  const [removing, setRemoving] = useState(false)

  if (loading) return null
  const model = settings.model ?? DEFAULT_MODEL
  const hasKey = Boolean(settings.apiKey)
  const level = privacyLevelOf(settings)
  const models = Object.keys(pricesOf(settings))
  if (!models.includes(model)) models.push(model)

  async function saveAndTest() {
    const key = keyDraft.trim()
    if (!key) return
    setTesting(true)
    setStatus(null)
    await update({ apiKey: key })
    const result = await testKey(key, model)
    setStatus(result.ok ? { ok: true, text: 'Key works · tested just now' } : { ok: false, text: result.error })
    setTesting(false)
    if (result.ok) {
      setEditingKey(false)
      setKeyDraft('')
    }
  }

  return (
    <div className="screen">
      <AppHeader back={{ label: 'Profile', to: '/profile' }} />
      <div className="page-v3">
        <h1 className="page-v3__title">AI</h1>
        <p className="page-v3__lead">Optional. Uses your own key. You always see what&apos;s sent before it goes.</p>
      </div>

      <ListGroup title="Your key">
        {hasKey && !editingKey ? (
          <>
            <ListRow title="Key saved on this phone" sub={`Ends in ${settings.apiKey!.slice(-4)}`} />
            <div className="lrow lrow--actions">
              <button type="button" className="btn btn--tertiary" onClick={() => setEditingKey(true)}>
                Replace
              </button>
              <button type="button" className="btn btn--destructive-text" onClick={() => setRemoving(true)}>
                Remove key
              </button>
            </div>
          </>
        ) : (
          <div className="key-v3">
            <label className="field-v3">
              <span className="field-v3__label">API key</span>
              <span className="field-v3__box">
                <input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-ant-…"
                  value={keyDraft}
                  onChange={(event) => setKeyDraft(event.target.value)}
                />
              </span>
            </label>
            <div className="key-v3__actions">
              <button type="button" className="btn btn--primary btn--small" disabled={testing || keyDraft.trim() === ''} onClick={() => void saveAndTest()}>
                {testing ? 'Testing…' : 'Save and test'}
              </button>
              {hasKey && (
                <button type="button" className="btn btn--tertiary" onClick={() => setEditingKey(false)}>
                  Cancel
                </button>
              )}
            </div>
            <a className="link-v3" href={KEY_HELP_URL} target="_blank" rel="noreferrer">
              How to get a key
            </a>
          </div>
        )}
      </ListGroup>
      {status && (
        <p className={status.ok ? 'note-v3' : 'note-v3 note-v3--danger'} role={status.ok ? 'status' : 'alert'}>
          {status.ok ? status.text : `That key didn’t work. ${status.text}`}
        </p>
      )}

      <ListGroup title="Model">
        <ListRow title="Model" value={model === DEFAULT_MODEL ? 'Default' : modelName(model)} onClick={() => setPicking(true)} />
      </ListGroup>

      <ListGroup title="Privacy level">
        <div role="radiogroup" aria-label="Privacy level">
          {PRIVACY_LEVELS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={level === option.value}
              className="lrow"
              onClick={() => void update({ privacyLevel: option.value })}
            >
              <span className="lrow__text">
                <span className={level === option.value ? 'lrow__title lrow__title--strong' : 'lrow__title'}>{option.title}</span>
                <span className="lrow__sub">{option.sub}</span>
              </span>
              <Check on={level === option.value} />
            </button>
          ))}
        </div>
      </ListGroup>
      <p className="note-v3">Body entries go at every level. Never sent: name, date of birth, height, age, sex or your API key.</p>
      <ListGroup>
        <ListRow title="What each level sends" onClick={() => navigate('/settings/privacy')} />
        <ListRow title="AI usage and budget" onClick={() => navigate('/settings/usage')} />
        <ListRow title="Sent log" onClick={() => navigate('/settings/sent-log')} />
      </ListGroup>

      {picking && (
        <Sheet title="Model" body="Costs use the price table in AI usage and budget." onClose={() => setPicking(false)}>
          <div role="radiogroup" aria-label="Model">
            {models.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === model}
                className="lrow"
                onClick={() => {
                  void update({ model: id })
                  setPicking(false)
                }}
              >
                <span className="lrow__text">
                  <span className="lrow__title">
                    {modelName(id)}
                    {id === DEFAULT_MODEL ? ' (default)' : ''}
                  </span>
                  <span className="lrow__sub">{id}</span>
                </span>
                <Check on={id === model} />
              </button>
            ))}
          </div>
          <label className="field-v3" style={{ marginTop: 12 }}>
            <span className="field-v3__label">Another model name</span>
            <span className="field-v3__box">
              <input
                id="model"
                type="text"
                spellCheck={false}
                autoCapitalize="off"
                placeholder={DEFAULT_MODEL}
                value={customModel}
                onChange={(event) => setCustomModel(event.target.value)}
              />
            </span>
          </label>
          <button
            type="button"
            className="btn btn--secondary"
            style={{ marginTop: 12 }}
            disabled={customModel.trim() === ''}
            onClick={() => {
              void update({ model: customModel.trim() })
              setCustomModel('')
              setPicking(false)
            }}
          >
            Use this model
          </button>
        </Sheet>
      )}
      {removing && (
        <Sheet title="Remove the key?" body="AI features stop until you add a key again. Nothing else changes." onClose={() => setRemoving(false)}>
          <button
            type="button"
            className="btn btn--destructive"
            onClick={() => {
              void update({ apiKey: undefined })
              setRemoving(false)
              setStatus(null)
            }}
          >
            Remove key
          </button>
          <button type="button" className="btn btn--tertiary" style={{ width: '100%' }} onClick={() => setRemoving(false)}>
            Cancel
          </button>
        </Sheet>
      )}
    </div>
  )
}

const KIND_LABEL: Record<SentLogEntry['kind'], string> = {
  review: 'Program review',
  update: 'Program update',
  meals: 'Meal estimate',
  week_note: 'Week review',
}

function nextMonthStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

function parseAmount(text: string): number | undefined {
  const value = Number(text.replace(/[$,\s]/g, ''))
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

/** Frame 3.17, with the price table, the console link and the key advice (task 10d). */
export function UsageScreen() {
  const navigate = useNavigate()
  const { settings, loading, update } = useSettings()
  const [log, setLog] = useState<SentLogEntry[] | null>(null)
  const [editing, setEditing] = useState<'budget' | 'warn' | { model: string } | 'add' | null>(null)
  const [draft, setDraft] = useState<{ a: string; b: string; name: string }>({ a: '', b: '', name: '' })

  useEffect(() => {
    let live = true
    void listSentLog().then((entries) => live && setLog(entries))
    return () => {
      live = false
    }
  }, [])

  if (loading || log === null) return null
  const now = new Date()
  const prices = pricesOf(settings)
  const budget = budgetOf(settings)
  const usage = monthUsage(log, prices, now)
  const state = budgetState(usage.cost, budget)
  const share = budget.monthlyUsd ? Math.min(1, usage.cost / budget.monthlyUsd) : 0
  const recent = [...log].reverse().filter((e) => e.status !== 'failed').slice(0, 3)
  const savePrices = (next: Record<string, ModelPrice>) => void update({ prices: next })

  return (
    <div className="screen">
      <AppHeader back={{ label: 'Profile', to: '/profile' }} />
      <div className="page-v3">
        <h1 className="page-v3__title">AI usage and budget</h1>
      </div>

      <div className="card-v3 usage-card">
        <div className="usage-card__label">{MONTH.format(now)} so far</div>
        <div className="usage-card__amount">
          <span className="usage-card__cost">{formatUsd(usage.cost)}</span>
          <span className="usage-card__of">{budget.monthlyUsd ? `of ${formatUsd(budget.monthlyUsd)} budget` : 'no budget set'}</span>
        </div>
        {budget.monthlyUsd !== undefined && (
          <div className="bar-v3 bar-v3--thick" aria-hidden="true">
            <span className={state === 'over' ? 'bar-v3__fill bar-v3__fill--danger' : state === 'warn' ? 'bar-v3__fill bar-v3__fill--warn' : 'bar-v3__fill'} style={{ width: `${share * 100}%` }} />
          </div>
        )}
        <div className="usage-card__meta">
          {usage.sends} {usage.sends === 1 ? 'send' : 'sends'} · resets {formatShortDate(toISODate(nextMonthStart(now)))}
        </div>
        {state === 'warn' && <div className="usage-card__state usage-card__state--warn">Past {budget.warnPct}% of your budget.</div>}
        {state === 'over' && (
          <div className="usage-card__state usage-card__state--danger">
            {budget.stopAtBudget ? 'Budget reached: AI sends are stopped until next month or until you raise it.' : 'Over budget. Sends continue because Stop is off.'}
          </div>
        )}
      </div>

      <ListGroup title="Budget">
        <ListRow title="Monthly budget" value={budget.monthlyUsd !== undefined ? formatUsd(budget.monthlyUsd) : 'None'} onClick={() => {
          setDraft({ a: budget.monthlyUsd !== undefined ? String(budget.monthlyUsd) : '', b: '', name: '' })
          setEditing('budget')
        }} />
        <div className="lrow">
          <span className="lrow__text">
            <span className="lrow__title">Stop sending at the budget</span>
          </span>
          <Switch label="Stop sending at the budget" on={budget.stopAtBudget} onChange={(on) => void update({ budget: { ...budget, stopAtBudget: on } })} />
        </div>
        <ListRow title="Warn me at" value={`${budget.warnPct}%`} onClick={() => {
          setDraft({ a: String(budget.warnPct), b: '', name: '' })
          setEditing('warn')
        }} />
      </ListGroup>

      <ListGroup title="Recent sends">
        {recent.length === 0 && <ListRow title="Nothing sent yet" />}
        {recent.map((entry) => {
          const cost = entryCost(entry, prices)
          return <ListRow key={entry.id} title={KIND_LABEL[entry.kind]} sub={formatDayDate(toISODate(new Date(entry.at)))} value={cost === null ? 'No price set' : formatUsd(cost)} />
        })}
        <ListRow title={<span className="link-v3">See the full sent log</span>} onClick={() => navigate('/settings/sent-log')} chevron={false} />
      </ListGroup>

      <ListGroup title="This month by model">
        {usage.perModel.length === 0 && <ListRow title="No sends this month" />}
        {usage.perModel.map((row) => (
          <ListRow
            key={row.model || 'unknown'}
            title={row.model ? modelName(row.model) : 'Model not recorded'}
            sub={`${row.inputTokens.toLocaleString('en-US')} in · ${row.outputTokens.toLocaleString('en-US')} out · ${row.sends} ${row.sends === 1 ? 'send' : 'sends'}`}
            value={row.cost === null ? 'No price set' : formatUsd(row.cost)}
          />
        ))}
      </ListGroup>

      <ListGroup title="Prices per million tokens">
        {Object.entries(prices).map(([model, price]) => (
          <ListRow
            key={model}
            title={modelName(model)}
            sub={model}
            value={`$${price.inputPerM} in · $${price.outputPerM} out`}
            onClick={() => {
              setDraft({ a: String(price.inputPerM), b: String(price.outputPerM), name: model })
              setEditing({ model })
            }}
          />
        ))}
        <ListRow title={<span className="link-v3">Add a model</span>} chevron={false} onClick={() => {
          setDraft({ a: '', b: '', name: '' })
          setEditing('add')
        }} />
        {settings.prices && (
          <ListRow title={<span className="link-v3">Restore published prices</span>} chevron={false} onClick={() => void update({ prices: undefined })} />
        )}
      </ListGroup>

      <ListGroup title="Limits">
        <a className="lrow" href={CONSOLE_LIMITS_URL} target="_blank" rel="noreferrer">
          <span className="lrow__text">
            <span className="lrow__title">Set a monthly limit in the Anthropic console</span>
            <span className="lrow__sub">Your account&apos;s limit is the one that always holds.</span>
          </span>
        </a>
        <ListRow title="Use a key made only for this app" sub="Its spend is then easy to see in the console, and you can turn it off without touching anything else." />
      </ListGroup>
      <p className="note-v3">Costs are estimates from your provider&apos;s published prices. Your provider&apos;s bill is the final word.</p>

      {editing === 'budget' && (
        <Sheet title="Monthly budget" body="In US dollars. Leave it empty for no budget." onClose={() => setEditing(null)}>
          <label className="field-v3">
            <span className="field-v3__box">
              <input type="text" inputMode="decimal" aria-label="Monthly budget in dollars" value={draft.a} placeholder="None" onChange={(e) => setDraft({ ...draft, a: e.target.value })} />
              <span className="field-v3__unit">USD</span>
            </span>
          </label>
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 14 }}
            onClick={() => {
              const amount = draft.a.trim() === '' ? undefined : parseAmount(draft.a)
              const next = { ...budget }
              if (amount === undefined || amount === 0) delete next.monthlyUsd
              else next.monthlyUsd = amount
              void update({ budget: next })
              setEditing(null)
            }}
          >
            Save
          </button>
        </Sheet>
      )}
      {editing === 'warn' && (
        <Sheet title="Warn me at" body={`A share of the budget, in percent. Default ${DEFAULT_WARN_PCT}%.`} onClose={() => setEditing(null)}>
          <label className="field-v3">
            <span className="field-v3__box">
              <input type="text" inputMode="numeric" aria-label="Warn at percent" value={draft.a} onChange={(e) => setDraft({ ...draft, a: e.target.value })} />
              <span className="field-v3__unit">%</span>
            </span>
          </label>
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 14 }}
            onClick={() => {
              const pct = Math.round(Number(draft.a))
              if (pct >= 1 && pct <= 100) void update({ budget: { ...budget, warnPct: pct } })
              setEditing(null)
            }}
          >
            Save
          </button>
        </Sheet>
      )}
      {editing !== null && typeof editing === 'object' && (
        <Sheet title={modelName(editing.model)} body={`${editing.model}: dollars per million tokens.`} onClose={() => setEditing(null)}>
          <PriceFields draft={draft} setDraft={setDraft} />
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 14 }}
            onClick={() => {
              const inputPerM = parseAmount(draft.a)
              const outputPerM = parseAmount(draft.b)
              if (inputPerM !== undefined && outputPerM !== undefined) savePrices({ ...prices, [editing.model]: { inputPerM, outputPerM } })
              setEditing(null)
            }}
          >
            Save
          </button>
          {!(editing.model in DEFAULT_PRICES) && (
            <button
              type="button"
              className="btn btn--destructive-text"
              style={{ width: '100%' }}
              onClick={() => {
                const next = { ...prices }
                delete next[editing.model]
                savePrices(next)
                setEditing(null)
              }}
            >
              Remove this row
            </button>
          )}
        </Sheet>
      )}
      {editing === 'add' && (
        <Sheet title="Add a model" body="The model name exactly as the API takes it, and its prices per million tokens." onClose={() => setEditing(null)}>
          <label className="field-v3">
            <span className="field-v3__label">Model name</span>
            <span className="field-v3__box">
              <input type="text" spellCheck={false} autoCapitalize="off" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </span>
          </label>
          <PriceFields draft={draft} setDraft={setDraft} />
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 14 }}
            onClick={() => {
              const inputPerM = parseAmount(draft.a)
              const outputPerM = parseAmount(draft.b)
              const name = draft.name.trim()
              if (name && inputPerM !== undefined && outputPerM !== undefined) savePrices({ ...prices, [name]: { inputPerM, outputPerM } })
              setEditing(null)
            }}
          >
            Add
          </button>
        </Sheet>
      )}
    </div>
  )
}

function PriceFields({ draft, setDraft }: { draft: { a: string; b: string; name: string }; setDraft: (d: { a: string; b: string; name: string }) => void }) {
  return (
    <div className="pair-v3" style={{ marginTop: 10 }}>
      <label className="field-v3">
        <span className="field-v3__label">Input</span>
        <span className="field-v3__box">
          <input type="text" inputMode="decimal" aria-label="Input price per million tokens" value={draft.a} onChange={(e) => setDraft({ ...draft, a: e.target.value })} />
          <span className="field-v3__unit">$/M</span>
        </span>
      </label>
      <label className="field-v3">
        <span className="field-v3__label">Output</span>
        <span className="field-v3__box">
          <input type="text" inputMode="decimal" aria-label="Output price per million tokens" value={draft.b} onChange={(e) => setDraft({ ...draft, b: e.target.value })} />
          <span className="field-v3__unit">$/M</span>
        </span>
      </label>
    </div>
  )
}
