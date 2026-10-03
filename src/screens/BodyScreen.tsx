// Body (D-077 rule 1, D-078): latest values, a new entry and history.

import { AppHeader, EmptyState } from '../ui/shell.tsx'

/** Frame 4.03 before Body entries are built. */
export function BodyPlaceholder() {
  return (
    <div className="screen">
      <AppHeader title="Body" />
      <EmptyState title="No entries yet" body="A scale weigh-in is one field. A full scan takes under a minute." />
    </div>
  )
}
