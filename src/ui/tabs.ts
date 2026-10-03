// D-077: five tabs, shown on every screen inside the app (D-083 rule 6).
// Pure rules, so the routing and the keyboard behaviour can be tested.

export type TabId = 'train' | 'meals' | 'body' | 'progress' | 'profile'

export const TABS: { id: TabId; to: string; label: string }[] = [
  { id: 'train', to: '/', label: 'Train' },
  { id: 'meals', to: '/meals', label: 'Meals' },
  { id: 'body', to: '/body', label: 'Body' },
  { id: 'progress', to: '/progress/training', label: 'Progress' },
  { id: 'profile', to: '/profile', label: 'Profile' },
]

/**
 * The tab a path belongs to. Settings and its sub-pages, the goal setter and
 * the AI review sit under Profile (D-083 rule 6); the deck under Train.
 */
export function tabFor(pathname: string): TabId | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/' || path === '/week' || path === '/deck') return 'train'
  const first = path.split('/')[1]
  switch (first) {
    case 'meals':
      return 'meals'
    case 'body':
      return 'body'
    case 'progress':
      return 'progress'
    case 'profile':
    case 'settings':
    case 'goal':
    case 'review':
      return 'profile'
    default:
      return null
  }
}

const NOT_TYPED = new Set(['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image', 'hidden'])

/**
 * D-077 rule 2: the tab bar hides while the keyboard is open, which is while
 * a text or number field has focus.
 */
export function isTypingTarget(element: { tagName?: string; type?: string; isContentEditable?: boolean } | null): boolean {
  if (!element || !element.tagName) return false
  const tag = element.tagName.toUpperCase()
  if (tag === 'TEXTAREA') return true
  if (tag === 'INPUT') return !NOT_TYPED.has((element.type ?? 'text').toLowerCase())
  return element.isContentEditable === true
}
