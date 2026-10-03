// Settings > Baseline foods (EXEC-10B task 7, D-049 rule 1): the user's own
// foods, matched on the phone by name. Add, edit and delete; protein optional.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BuilderBar, Hero } from '../builder/ui.tsx'
import { SectionHead } from '../onboarding/ui.tsx'
import { useSettings } from '../settings/useSettings.ts'
import type { MealFood } from '../types/stores.ts'

/** D-079 rule 1: a food's optional values beyond calories, counted on the phone. */
const OPTIONAL = [
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbohydrate', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
  { key: 'fibreG', label: 'Fibre', unit: 'g' },
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg' },
  { key: 'addedSugarG', label: 'Added sugars', unit: 'g' },
  { key: 'satFatG', label: 'Saturated fat', unit: 'g' },
] as const

type OptionalKey = (typeof OPTIONAL)[number]['key']

type Draft = { index: number | null; name: string; kcal: string } & Record<OptionalKey, string>

function draftOf(index: number | null, food?: MealFood): Draft {
  const draft = { index, name: food?.name ?? '', kcal: food ? String(food.kcal) : '' } as Draft
  for (const { key } of OPTIONAL) draft[key] = food?.[key] === undefined ? '' : String(food[key])
  return draft
}

const num = (text: string) => Number(text.trim().replace(',', '.'))

function draftError(draft: Draft, foods: MealFood[]): string | null {
  const name = draft.name.trim().replace(/\s+/g, ' ')
  if (name === '') return 'Give the food a name.'
  if (foods.some((f, i) => i !== draft.index && f.name.trim().toLowerCase() === name.toLowerCase())) return 'You already have a food with this name.'
  if (draft.kcal.trim() === '' || !Number.isFinite(num(draft.kcal)) || num(draft.kcal) < 0) return 'Enter calories as a number.'
  for (const { key, label } of OPTIONAL) {
    if (draft[key].trim() !== '' && (!Number.isFinite(num(draft[key])) || num(draft[key]) < 0)) return `Enter ${label.toLowerCase()} as a number, or leave it empty.`
  }
  return null
}

export function FoodsScreen() {
  const navigate = useNavigate()
  const { settings, loading, update } = useSettings()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [tried, setTried] = useState(false)

  if (loading) return null
  const foods = settings.mealFoods ?? []
  const error = draft ? draftError(draft, foods) : null

  function save() {
    if (!draft) return
    setTried(true)
    if (error) return
    const food: MealFood = { name: draft.name.trim().replace(/\s+/g, ' '), kcal: num(draft.kcal) }
    for (const { key } of OPTIONAL) if (draft[key].trim() !== '') food[key] = num(draft[key])
    const next = draft.index === null ? [...foods, food] : foods.map((f, i) => (i === draft.index ? food : f))
    void update({ mealFoods: next })
    setDraft(null)
    setTried(false)
  }

  function remove(index: number) {
    void update({ mealFoods: foods.filter((_, i) => i !== index) })
    setDraft(null)
    setTried(false)
  }

  const form = draft && (
    <div className="ml-food-form">
      <div className="bd-label">Name</div>
      <div className="bd-input">
        <input aria-label="Name" placeholder="breakfast" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </div>
      <div className="food-grid" style={{ marginTop: 12 }}>
        <div>
          <div className="bd-label">Calories</div>
          <div className="bd-input">
            <input inputMode="decimal" aria-label="Calories" value={draft.kcal} onChange={(e) => setDraft({ ...draft, kcal: e.target.value })} />
            <span className="bd-input__unit">kcal</span>
          </div>
        </div>
        {OPTIONAL.map(({ key, label, unit }) => (
          <div key={key}>
            <div className="bd-label">{label}</div>
            <div className="bd-input">
              <input inputMode="decimal" aria-label={label} placeholder="Optional" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
              <span className="bd-input__unit">{unit}</span>
            </div>
          </div>
        ))}
      </div>
      {tried && error && <div className="bd-label bd-label--error" style={{ marginTop: 8 }}>{error}</div>}
      <div className="ai-banner__actions">
        <button type="button" className="ai-btn ai-btn--primary" onClick={save}>
          Save
        </button>
        <button type="button" className="ai-btn" onClick={() => { setDraft(null); setTried(false) }}>
          Cancel
        </button>
        {draft.index !== null && (
          <button type="button" className="ai-btn" style={{ color: 'var(--danger)' }} onClick={() => remove(draft.index as number)}>
            Delete
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <BuilderBar title="Settings" onBack={() => navigate('/settings')} />
      <Hero title="Baseline foods" sub="Foods you eat often. Lines that name one are counted on this phone and never sent." />
      <div style={{ margin: '0 24px' }}>
        <SectionHead aside={`${foods.length} ${foods.length === 1 ? 'food' : 'foods'}`}>Your foods</SectionHead>
        {foods.length === 0 && !draft && <div className="bd-hint">No foods yet.</div>}
        {foods.map((food, index) =>
          draft?.index === index ? (
            <div key={index}>{form}</div>
          ) : (
            <button
              type="button"
              className="ml-line ml-food"
              key={index}
              onClick={() => { setTried(false); setDraft(draftOf(index, food)) }}
            >
              <span className="ml-line__text">{food.name}</span>
              <span className="bd-value" style={{ fontSize: 14 }}>
                {food.kcal} kcal{food.proteinG !== undefined ? ` · ${food.proteinG} g` : ''}
              </span>
            </button>
          ),
        )}
        {draft?.index === null ? (
          form
        ) : (
          <div className="ai-banner__actions">
            <button type="button" className="ai-btn" onClick={() => { setTried(false); setDraft(draftOf(null)) }}>
              Add a food
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
