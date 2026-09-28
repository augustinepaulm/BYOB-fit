import { Navigate, Outlet } from 'react-router-dom'

import { firstRunRoute } from '../lib/onboarding.ts'
import { useSettings } from '../settings/useSettings.ts'
import { useProgram } from './useProgram.ts'

/**
 * With no active program the app goes to onboarding, or to the import screen
 * once onboarding has been completed (PLAN 7.5, firstRunRoute).
 */
export function RequireProgram() {
  const { loading, program } = useProgram()
  const { loading: settingsLoading, settings } = useSettings()
  if (loading || settingsLoading) return null
  const route = firstRunRoute({
    hasProgram: program !== null,
    onboardingCompletedAt: settings.onboarding?.completedAt,
  })
  if (route !== 'proceed') return <Navigate to={route} replace />
  return <Outlet />
}
