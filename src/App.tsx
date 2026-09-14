import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { ProgramProvider } from './program/ProgramProvider.tsx'
import { RequireProgram } from './program/RequireProgram.tsx'
import { ImportScreen } from './screens/ImportScreen.tsx'
import {
  LogScreen,
  MealsScreen,
  ProfileScreen,
  SettingsScreen,
} from './screens/Placeholders.tsx'
import { TodayScreen } from './screens/TodayScreen.tsx'
import { WeekScreen } from './screens/WeekScreen.tsx'
import { PlainLayout, TabbedLayout } from './ui/AppShell.tsx'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ProgramProvider>
        <Routes>
          <Route element={<PlainLayout />}>
            <Route path="/import" element={<ImportScreen />} />
          </Route>
          <Route element={<RequireProgram />}>
            <Route element={<TabbedLayout />}>
              <Route path="/" element={<TodayScreen />} />
              <Route path="/week" element={<WeekScreen />} />
              <Route path="/log" element={<LogScreen />} />
              <Route path="/meals" element={<MealsScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
            </Route>
            <Route element={<PlainLayout />}>
              <Route path="/settings" element={<SettingsScreen />} />
            </Route>
          </Route>
        </Routes>
      </ProgramProvider>
    </BrowserRouter>
  )
}
