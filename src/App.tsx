import { HashRouter, Route, Routes } from 'react-router-dom'

import { ProgramProvider } from './program/ProgramProvider.tsx'
import { AppNotices } from './pwa/AppNotices.tsx'
import { RequireProgram } from './program/RequireProgram.tsx'
import { BuildScreen } from './screens/BuildScreen.tsx'
import { DeckScreen } from './screens/DeckScreen.tsx'
import { ImportScreen } from './screens/ImportScreen.tsx'
import { FoodsScreen } from './screens/FoodsScreen.tsx'
import { GoalScreen } from './screens/GoalScreen.tsx'
import { ExerciseLogScreen, LogScreen } from './screens/LogScreen.tsx'
import { MealsScreen } from './screens/MealsScreen.tsx'
import { OnboardingScreen } from './screens/OnboardingScreen.tsx'
import { PrivacyLevelScreen, SentLogScreen } from './screens/PrivacyScreens.tsx'
import { ReviewScreen } from './screens/ReviewScreen.tsx'
import { EditProgramScreen, NewProgramScreen } from './screens/ProgramScreens.tsx'
import { ProfileScreen } from './screens/ProfileScreen.tsx'
import { SettingsScreen } from './screens/SettingsScreen.tsx'
import { TodayScreen } from './screens/TodayScreen.tsx'
import { WeekScreen } from './screens/WeekScreen.tsx'
import { PlainLayout, TabbedLayout } from './ui/AppShell.tsx'

// D-022: routes live after the hash, so GitHub Pages needs no SPA fallback.
export default function App() {
  return (
    <HashRouter>
      <ProgramProvider>
        <AppNotices />
        <Routes>
          <Route element={<PlainLayout />}>
            <Route path="/import" element={<ImportScreen />} />
            <Route path="/welcome" element={<OnboardingScreen />} />
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
              <Route path="/build" element={<BuildScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/goal" element={<GoalScreen />} />
              <Route path="/program/edit" element={<EditProgramScreen />} />
              <Route path="/program/new" element={<NewProgramScreen />} />
              <Route path="/review" element={<ReviewScreen />} />
              <Route path="/settings/privacy" element={<PrivacyLevelScreen />} />
              <Route path="/settings/sent-log" element={<SentLogScreen />} />
              <Route path="/settings/foods" element={<FoodsScreen />} />
            </Route>
          </Route>
        </Routes>
      </ProgramProvider>
    </HashRouter>
  )
}
