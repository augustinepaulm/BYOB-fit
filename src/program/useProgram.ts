import { useContext } from 'react'

import { ProgramContext, type ProgramState } from './context.ts'

export function useProgram(): ProgramState {
  const value = useContext(ProgramContext)
  if (!value) throw new Error('useProgram must be used inside ProgramProvider')
  return value
}
