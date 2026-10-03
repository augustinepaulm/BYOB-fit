import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'

import { ProgramProvider } from './program/ProgramProvider.tsx'
import { AppNotices } from './pwa/AppNotices.tsx'
import { RequireProgram } from './program/RequireProgram.tsx'
import { PrivacyPageScreen, SafetyScreen } from './screens/AboutScreens.tsx'
import { BuildScreen } from './screens/BuildScreen.tsx'
import { DeckScreen } from './screens/DeckScreen.tsx'
import { ImportScreen } from './screens/ImportScreen.tsx'
import { FoodsScreen } from './screens/FoodsScreen.tsx'
import { GoalScreen } from './screens/GoalScreen.tsx'
import { ExerciseLogScreen } from './screens/LogScreen.tsx'
import { MealsScreen } from './screens/MealsScreen.tsx'
import { OnboardingScreen } from './screens/OnboardingScreen.tsx'
import { PrivacyLevelScreen, SentLogScreen } from './screens/PrivacyScreens.tsx'
import { ReviewScreen } from './screens/ReviewScreen.tsx'
import { EditProgramScreen, NewProgramScreen } from './screens/ProgramScreens.tsx'
import { ProfileScreen } from './screens/ProfileScreen.tsx'
import { SettingsScreen } from './screens/SettingsScreen.tsx'
import { TodayLoading, TodayScreen } from './screens/TodayScreen.tsx'
import { WeekScreen } from './screens/WeekScreen.tsx'
import { BodyEntryScreen, BodyHistoryScreen, BodyScreen } from './screens/BodyScreen.tsx'
import { AiSettingsScreen, UsageScreen } from './screens/AiSettingsScreens.tsx'
import { ProgressScreen } from './screens/ProgressScreen.tsx'
import { PlainLayout, TabbedLayout } from './ui/AppShell.tsx'

/** D-077 rule 1: the Log moved to Progress > Training; old links still land. */
function LogRedirect() {
  const { exerciseId } = useParams()
  return <Navigate replace to={exerciseId ? `/progress/training/${exerciseId}` : '/progress/training'} />
}

// D-022: routes live after the hash, so GitHub Pages needs no SPA fallback.
// D-077, D-083 rule 6: the five tabs show on every screen inside the app;
// onboarding, import and the builder are full-screen flows without them.
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
          <Route path="/log" element={<LogRedirect />} />
          <Route path="/log/:exerciseId" element={<LogRedirect />} />
          {/* Screens with an empty state for "no program yet" (7a, 7c). */}
          <Route element={<RequireProgram allowEmpty todayLoading={<TodayLoading />} />}>
            <Route element={<TabbedLayout />}>
              <Route path="/" element={<TodayScreen />} />
              <Route path="/week" element={<WeekScreen />} />
              <Route path="/meals" element={<MealsScreen />} />
              <Route path="/body" element={<BodyScreen />} />
              <Route path="/body/new" element={<BodyEntryScreen />} />
              <Route path="/body/history" element={<BodyHistoryScreen />} />
              <Route path="/progress" element={<Navigate replace to="/progress/training" />} />
              <Route path="/progress/training" element={<ProgressScreen view="training" />} />
              <Route path="/progress/training/:exerciseId" element={<ExerciseLogScreen />} />
              <Route path="/progress/nutrition" element={<ProgressScreen view="nutrition" />} />
              <Route path="/progress/body" element={<ProgressScreen view="body" />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/goal" element={<GoalScreen />} />
              <Route path="/settings/ai" element={<AiSettingsScreen />} />
              <Route path="/settings/usage" element={<UsageScreen />} />
              <Route path="/settings/privacy" element={<PrivacyLevelScreen />} />
              <Route path="/settings/sent-log" element={<SentLogScreen />} />
              <Route path="/settings/foods" element={<FoodsScreen />} />
              <Route path="/settings/privacy-page" element={<PrivacyPageScreen />} />
              <Route path="/settings/safety" element={<SafetyScreen />} />
            </Route>
            <Route element={<PlainLayout />}>
              <Route path="/program/new" element={<NewProgramScreen />} />
            </Route>
          </Route>
          {/* Screens that need a program. */}
          <Route element={<RequireProgram />}>
            <Route element={<TabbedLayout />}>
              <Route path="/deck" element={<DeckScreen />} />
              <Route path="/review" element={<ReviewScreen />} />
            </Route>
            <Route element={<PlainLayout />}>
              <Route path="/build" element={<BuildScreen />} />
              <Route path="/program/edit" element={<EditProgramScreen />} />
            </Route>
          </Route>
        </Routes>
      </ProgramProvider>
    </HashRouter>
  )
}
