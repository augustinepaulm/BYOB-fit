// Date text for the screens, in the shapes the design file uses.

const LONG = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
})
const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})
const SHORT_DAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

/** "Monday, Sep 14" */
export function formatLongDate(date: Date): string {
  return LONG.format(date)
}

/** "Sun" */
export function formatShortDay(date: Date): string {
  return SHORT_DAY.format(date)
}

/** "Sep 13 – 19", or "Sep 27 – Oct 3" across a month boundary. */
export function formatWeekRange(dates: Date[]): string {
  const first = dates[0]
  const last = dates[dates.length - 1]
  const end =
    first.getMonth() === last.getMonth()
      ? String(last.getDate())
      : MONTH_DAY.format(last)
  return `${MONTH_DAY.format(first)} – ${end}`
}

/** YYYY-MM-DD in local time, the key shape the stores use. */
export function toISODate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

export function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Aug 9 2026 is a Sunday, so it anchors order 0 for weekday names. */
const SUNDAY_ANCHOR = new Date(2026, 7, 9)

/** "Sun" for order 0 through "Sat" for order 6. */
export function formatDayOrder(order: number): string {
  return SHORT_DAY.format(
    new Date(
      SUNDAY_ANCHOR.getFullYear(),
      SUNDAY_ANCHOR.getMonth(),
      SUNDAY_ANCHOR.getDate() + order,
    ),
  )
}
