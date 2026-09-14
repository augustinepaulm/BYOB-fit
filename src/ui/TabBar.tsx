import { NavLink } from 'react-router-dom'

import {
  LogIcon,
  MealsIcon,
  ProfileIcon,
  TodayIcon,
  WeekIcon,
} from './icons.tsx'

const TABS = [
  { to: '/', label: 'Today', Icon: TodayIcon },
  { to: '/week', label: 'Week', Icon: WeekIcon },
  { to: '/log', label: 'Log', Icon: LogIcon },
  { to: '/meals', label: 'Meals', Icon: MealsIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
]

export function TabBar() {
  return (
    <nav className="tabbar">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => (isActive ? 'tab tab--active' : 'tab')}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
