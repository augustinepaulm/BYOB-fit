import { HashRouter, Route, Routes } from 'react-router-dom'

import { ProgramProvider } from './program/ProgramProvider.tsx'
import { RequireProgram } from './program/RequireProgram.tsx'
import { DeckScreen } from './screens/DeckScreen.tsx'
import { ImportScreen } from './screens/ImportScreen.tsx'
import { ExerciseLogScreen, LogScreen } from './screens/LogScreen.tsx'
import {
  MealsScreen,
  ProfileScreen,
  SettingsScreen,
} from './screens/Placeholders.tsx'
import { TodayScreen } from './screens/TodayScreen.tsx'
import { WeekScreen } from './screens/WeekScreen.tsx'
import { PlainLayout, TabbedLayout } from './ui/AppShell.tsx'

// D-022: routes live after the hash, so GitHub Pages needs no SPA fallback.
export default function App() {
  return (
    <HashRouter>
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
              <Route path="/log/:exerciseId" element={<ExerciseLogScreen />} />
              <Route path="/meals" element={<MealsScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
            </Route>
            <Route element={<PlainLayout />}>
              <Route path="/deck" element={<DeckScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Route>
          </Route>
        </Routes>
      </ProgramProvider>
    </HashRouter>
  )
}
