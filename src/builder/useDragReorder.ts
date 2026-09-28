// Drag a row by its handle to reorder a list (2f days, 2g items). Move up and
// Move down buttons sit beside every handle for anyone who cannot drag.

import { useRef, useState, type PointerEvent } from 'react'

export function useDragReorder(count: number, onMove: (from: number, to: number) => void) {
  const drag = useRef<{ index: number; startY: number; rowHeight: number } | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  function handleProps(index: number) {
    return {
      'aria-hidden': true as const,
      onPointerDown(event: PointerEvent<HTMLElement>) {
        const row = event.currentTarget.closest('[data-drag-row]') as HTMLElement | null
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { index, startY: event.clientY, rowHeight: row?.offsetHeight ?? 54 }
        setDragging(index)
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const state = drag.current
        if (!state) return
        const steps = Math.trunc((event.clientY - state.startY) / state.rowHeight)
        if (steps === 0) return
        const to = Math.max(0, Math.min(count - 1, state.index + steps))
        if (to === state.index) return
        onMove(state.index, to)
        drag.current = { ...state, index: to, startY: state.startY + (to - state.index) * state.rowHeight }
        setDragging(to)
      },
      onPointerUp() {
        drag.current = null
        setDragging(null)
      },
      onPointerCancel() {
        drag.current = null
        setDragging(null)
      },
    }
  }

  return { dragging, handleProps }
}
