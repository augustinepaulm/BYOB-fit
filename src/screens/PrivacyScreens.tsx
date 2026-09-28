// Settings > Privacy level (5e) and Settings > Sent log (5h), EXEC-09 task 5.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PrivacyLevelPicker } from '../ai/Privacy.tsx'
import { sentStatusOf } from '../ai/send.ts'
import { BuilderBar, Hero } from '../builder/ui.tsx'
import { listSentLog } from '../db/index.ts'
import { LEVEL_LABEL } from '../lib/payload.ts'
import { SectionHead } from '../onboarding/ui.tsx'
import { privacyLevelOf } from '../settings/defaults.ts'
import { useSettings } from '../settings/useSettings.ts'
import type { SentLogEntry } from '../types/stores.ts'
import { StateBlock } from '../ui/StateBlock.tsx'

export function PrivacyLevelScreen() {
  const navigate = useNavigate()
  const { settings, loading, update } = useSettings()
  if (loading) return null
  return (
    <PrivacyLevelPicker
      value={privacyLevelOf(settings)}
      onChange={(privacyLevel) => void update({ privacyLevel })}
      onBack={() => navigate('/settings')}
    />
  )
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long' })
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const SHORT_MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' })
const TITLE: Record<SentLogEntry['kind'], string> = { review: 'Review', update: 'Update', meals: 'Meals' }

function summaryPairs(text: string): [string, string][] {
  return text.split(' · ').map((part) => {
    const at = part.indexOf(': ')
    return at < 0 ? [part, ''] : [part.slice(0, at), part.slice(at + 2)]
  })
}

/** "Minimal · program, 38 sets" (frame 5h). */
function rowSub(entry: SentLogEntry): string {
  const pairs = Object.fromEntries(summaryPairs(entry.payloadSummary))
  const what =
    entry.kind === 'meals'
      ? (pairs['Meal lines'] ?? '')
      : entry.kind === 'update'
        ? `program, ${(pairs.Logged ?? '').split(' from ')[0]}`
        : 'program, goal'
  return `${LEVEL_LABEL[entry.privacyLevel]} · ${what}`
}

export function SentLogScreen() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<SentLogEntry[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void listSentLog().then((found) => live && setEntries(found))
    return () => {
      live = false
    }
  }, [])

  // Newest first, grouped by month.
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: SentLogEntry[] }[] = []
    const thisYear = new Date().getFullYear()
    for (const entry of [...(entries ?? [])].sort((a, b) => b.at.localeCompare(a.at))) {
      const date = new Date(entry.at)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      let group = out.find((g) => g.key === key)
      if (!group) {
        group = { key, label: date.getFullYear() === thisYear ? MONTH.format(date) : MONTH_YEAR.format(date), items: [] }
        out.push(group)
      }
      group.items.push(entry)
    }
    return out
  }, [entries])

  if (entries === null) return null
  return (
    <div className="ob" style={{ paddingBottom: 40 }}>
      <BuilderBar title="Settings" onBack={() => navigate('/settings')} />
      <Hero title="Sent log" sub="Everything this phone has sent to Anthropic. Nothing here can be edited." />
      <div style={{ margin: '0 24px' }}>
        {groups.length === 0 && (
          // 7e "Sent log, empty"
          <div className="lg-state" style={{ marginTop: 16 }}>
            <StateBlock mark="–" title="Nothing sent yet" body="AI calls appear here after you tap Send." />
          </div>
        )}
        {groups.map((group) => (
          <div key={group.key}>
            <SectionHead aside={`${group.items.length} ${group.items.length === 1 ? 'call' : 'calls'}`}>{group.label}</SectionHead>
            {group.items.map((entry) => {
              const date = new Date(entry.at)
              const expanded = open === entry.id
              return (
                <div className="ai-sent" key={entry.id}>
                  <button type="button" className="ai-sent__row" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : entry.id)}>
                    <div className="ai-sent__date">
                      <div className="ai-sent__month">{SHORT_MONTH.format(date)}</div>
                      <div className="ai-sent__day">{date.getDate()}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="ai-sent__title">{TITLE[entry.kind]}</div>
                      <div className="ai-sent__sub">{rowSub(entry)}</div>
                      {/* D-050 rule 1 */}
                      {sentStatusOf(entry) === 'failed' && (
                        <div className="ai-sent__failed">
                          <b>Failed</b>
                          {entry.error ? ` · ${entry.error}` : ''}
                        </div>
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="ai-sent__detail">
                      {summaryPairs(entry.payloadSummary).map(([label, value]) => (
                        <div className="ai-sent__line" key={label}>
                          <span style={{ color: 'var(--secondary)', flex: 'none' }}>{label}</span>
                          <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
                        </div>
                      ))}
                      <div className="bd-label" style={{ marginTop: 10 }}>
                        Exactly what was sent
                      </div>
                      <pre className="ai-raw">{String(entry.payload)}</pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
