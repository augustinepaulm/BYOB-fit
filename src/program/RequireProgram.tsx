import { Navigate, Outlet } from 'react-router-dom'

import { useProgram } from './useProgram.ts'

/** On load, with no active program, the app goes to the import screen. */
export function RequireProgram() {
  const { loading, program } = useProgram()
  if (loading) return null
  if (!program) return <Navigate to="/import" replace />
  return <Outlet />
}
