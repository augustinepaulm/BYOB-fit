// Settings > Baseline foods (EXEC-10B task 7, D-049 rule 1): the user's own
// foods, matched on the phone by name. Add, edit and delete; protein optional.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BuilderBar, Hero } from '../builder/ui.tsx'
import { SectionHead } from '../onboarding/ui.tsx'
import { useSettings } from '../settings/useSettings.ts'
import type { MealFood } from '../types/stores.ts'

type Draft = { index: number | null; name: string; kcal: string; proteinG: string }

const num = (text: string) => Number(text.trim().replace(',', '.'))

function draftError(draft: Draft, foods: MealFood[]): string | null {
  const name = draft.name.trim().replace(/\s+/g, ' ')
  if (name === '') return 'Give the food a name.'
  if (foods.some((f, i) => i !== draft.index && f.name.trim().toLowerCase() === name.toLowerCase())) return 'You already have a food with this name.'
  if (draft.kcal.trim() === '' || !Number.isFinite(num(draft.kcal)) || num(draft.kcal) < 0) return 'Enter calories as a number.'
  if (draft.proteinG.trim() !== '' && (!Number.isFinite(num(draft.proteinG)) || num(draft.proteinG) < 0)) return 'Enter protein as a number, or leave it empty.'
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
    if (draft.proteinG.trim() !== '') food.proteinG = num(draft.proteinG)
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
      <div className="bd-cols" style={{ marginTop: 12 }}>
        <div>
          <div className="bd-label">Calories</div>
          <div className="bd-input">
            <input inputMode="decimal" aria-label="Calories" value={draft.kcal} onChange={(e) => setDraft({ ...draft, kcal: e.target.value })} />
            <span className="bd-input__unit">kcal</span>
          </div>
        </div>
        <div>
          <div className="bd-label">Protein</div>
          <div className="bd-input">
            <input inputMode="decimal" aria-label="Protein" placeholder="Optional" value={draft.proteinG} onChange={(e) => setDraft({ ...draft, proteinG: e.target.value })} />
            <span className="bd-input__unit">g</span>
          </div>
        </div>
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
              onClick={() => { setTried(false); setDraft({ index, name: food.name, kcal: String(food.kcal), proteinG: food.proteinG === undefined ? '' : String(food.proteinG) }) }}
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
            <button type="button" className="ai-btn" onClick={() => { setTried(false); setDraft({ index: null, name: '', kcal: '', proteinG: '' }) }}>
              Add a food
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
