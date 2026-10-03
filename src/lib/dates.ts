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

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/** A YYYY-MM-DD date as a local Date. */
export function fromISODate(iso: string): Date {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
}

/** "1 Oct" (v3 frames). */
export function formatShortDate(iso: string): string {
  return DAY_MONTH.format(fromISODate(iso)).replace('Sept', 'Sep')
}

/** "Thu 1 Oct" (v3 frames 3.06, 3.08). */
export function formatDayDate(iso: string): string {
  // Some ICU versions write "Sept"; the frames use three letters throughout.
  return WEEKDAY_DAY_MONTH.format(fromISODate(iso)).replace(',', '').replace('Sept', 'Sep')
}

/** The Train header's context text (frame 2.01): "Thu · week 6". */
export function formatTrainContext(date: Date, week: number): string {
  return `${SHORT_DAY.format(date)} · week ${week}`
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
