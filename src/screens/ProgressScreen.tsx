// Progress (D-077 rule 1, D-080): Training, Nutrition and Body, switched at
// the top. Training holds the exercise list, history and set editing that
// were the Log tab.

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppHeader, EmptyState, Segmented } from '../ui/shell.tsx'

export type ProgressView = 'training' | 'nutrition' | 'body'

const VIEWS: { value: ProgressView; label: string }[] = [
  { value: 'training', label: 'Training' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'body', label: 'Body' },
]

export function ProgressHeader({ view, context }: { view: ProgressView; context?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <AppHeader context={context}>
      <Segmented label="Progress" value={view} options={VIEWS} onChange={(next) => navigate(`/progress/${next}`)} />
    </AppHeader>
  )
}

export function ProgressFrame({ view, children }: { view: ProgressView; children: ReactNode }) {
  return (
    <div className="screen">
      <ProgressHeader view={view} />
      {children}
    </div>
  )
}

/** Nutrition and Body before their scores are built. */
export function ProgressPlaceholder({ view }: { view: Exclude<ProgressView, 'training'> }) {
  return (
    <ProgressFrame view={view}>
      <EmptyState
        title="No score yet"
        body={view === 'nutrition' ? 'Log meals this week and your nutrition shows here.' : 'Add body entries and your trends show here.'}
      />
    </ProgressFrame>
  )
}
