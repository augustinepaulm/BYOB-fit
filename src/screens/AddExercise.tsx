// Add exercise (D-069 rule 7): every active item of the program, each shown
// as "<exercise> · <day> · <prescription>", searchable by name.

import { useMemo, useState } from 'react'

import { BuilderBar, SearchGlyph } from '../builder/ui.tsx'
import { searchAddable, type AddableItem } from '../lib/sessionExercises.ts'

export function AddExercise({ items, onPick, onBack }: { items: AddableItem[]; onPick: (item: AddableItem) => void; onBack: () => void }) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => searchAddable(items, query), [items, query])
  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <BuilderBar title="Add exercise" onBack={onBack} />
      <div className="bd-hint" style={{ margin: '0 24px 8px' }}>
        For today only, right after the current exercise, with that day&apos;s prescription.
      </div>
      <label className="bd-search">
        <SearchGlyph />
        <input type="search" placeholder="Search exercises" aria-label="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div style={{ margin: '8px 24px 0' }} role="list" aria-label="Exercises in your program">
        {shown.map((entry) => (
          <button type="button" role="listitem" className="dk-add__row" key={`${entry.day.id}:${entry.item.id}`} onClick={() => onPick(entry)}>
            {entry.label}
          </button>
        ))}
        {shown.length === 0 && <div className="bd-hint" style={{ padding: '16px 0' }}>No exercise in your program matches.</div>}
      </div>
    </div>
  )
}
