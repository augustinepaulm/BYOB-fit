import { Outlet } from 'react-router-dom'

import { TabBar } from './TabBar.tsx'

/** The five tabbed screens. */
export function TabbedLayout() {
  return (
    <div className="app app--tabbed">
      <Outlet />
      <TabBar />
    </div>
  )
}

/**
 * Screens the design shows without the tab bar: Settings (pushed from the
 * Profile gear, with a back chevron) and Import (reached before a program
 * exists, when there is nothing to navigate to).
 */
export function PlainLayout() {
  return (
    <div className="app">
      <Outlet />
    </div>
  )
}
