import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { firstRunRoute } from '../lib/onboarding.ts'
import { useSettings } from '../settings/useSettings.ts'
import { useProgram } from './useProgram.ts'

/**
 * Before onboarding is complete the app goes to onboarding (PLAN 7.5,
 * firstRunRoute). After it, a missing program is an empty state (frames 7a,
 * 7c, EXEC-11 task 9): screens that can show one render (`allowEmpty`);
 * screens that need a program go to Today, which offers a starter or the
 * builder. Import stays reachable from Settings and Start a new program.
 */
export function RequireProgram({
  allowEmpty = false,
  todayLoading,
}: {
  allowEmpty?: boolean
  /** Shown on Today while the program is read (frame 7a "Loading"). */
  todayLoading?: ReactNode
}) {
  const { loading, program } = useProgram()
  const { loading: settingsLoading, settings } = useSettings()
  const { pathname } = useLocation()
  if (loading || settingsLoading) return pathname === '/' ? (todayLoading ?? null) : null
  const route = firstRunRoute({
    hasProgram: program !== null,
    onboardingCompletedAt: settings.onboarding?.completedAt,
  })
  if (route === 'proceed') return <Outlet />
  if (route === '/welcome') return <Navigate to="/welcome" replace />
  return allowEmpty ? <Outlet /> : <Navigate to="/" replace />
}
