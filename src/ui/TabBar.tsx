import { Link, useLocation } from 'react-router-dom'

import { TABS, tabFor, type TabId } from './tabs.ts'

/** The tab glyphs, drawn as CSS shapes as in the v3 canvas. */
function Glyph({ id }: { id: TabId }) {
  switch (id) {
    case 'train':
      return (
        <span className="tg tg--train" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )
    case 'meals':
      return <span className="tg tg--meals" aria-hidden="true" />
    case 'body':
      return <span className="tg tg--body" aria-hidden="true" />
    case 'progress':
      return (
        <span className="tg tg--progress" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )
    case 'profile':
      return (
        <span className="tg tg--profile" aria-hidden="true">
          <span />
          <span />
        </span>
      )
  }
}

/** D-077: Train, Meals, Body, Progress, Profile; navy in every appearance. */
export function TabBar() {
  const active = tabFor(useLocation().pathname)
  return (
    <nav className="tabbar" aria-label="Tabs">
      {TABS.map(({ id, to, label }) => (
        <Link
          key={id}
          to={to}
          className={id === active ? 'tab tab--active' : 'tab'}
          aria-current={id === active ? 'page' : undefined}
        >
          <Glyph id={id} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
