// Inline SVG charts for Progress (D-082 rule 4: no library, nothing the
// policy blocks). Colours come from CSS classes on tokens.

import type { ReactNode } from 'react'

export interface Point {
  date: string
  value: number
}

const dayNo = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000

/** A card with a title, an aside and a legend. */
export function ChartCard({ title, aside, children, legend }: { title: string; aside?: ReactNode; children: ReactNode; legend?: { label: string; tone: string; dashed?: boolean }[] }) {
  return (
    <section className="card-v3 chart-card">
      <div className="chart-card__head">
        <h3 className="chart-card__title">{title}</h3>
        {aside && <span className="chart-card__aside">{aside}</span>}
      </div>
      <div className="chart-card__body">{children}</div>
      {legend && (
        <div className="chart-legend">
          {legend.map((item) => (
            <span key={item.label} className="chart-legend__item">
              <span className={`chart-legend__swatch chart-legend__swatch--${item.tone}${item.dashed ? ' chart-legend__swatch--dashed' : ''}`} />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

/** Lines over dates sharing one axis; `dots` draws points only. */
export function LineChart({
  series,
  height = 120,
  label,
}: {
  series: { points: Point[]; tone: string; dots?: boolean }[]
  height?: number
  label: string
}) {
  const all = series.flatMap((s) => s.points)
  if (all.length === 0) return null
  const width = 318
  const pad = 8
  const xs = all.map((p) => dayNo(p.date))
  const ys = all.map((p) => p.value)
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  const [lo, hi] = [Math.min(...ys), Math.max(...ys)]
  const spanY = hi - lo || Math.max(1, Math.abs(hi) * 0.05)
  const x = (d: string) => (x1 === x0 ? width / 2 : pad + ((dayNo(d) - x0) / (x1 - x0)) * (width - 2 * pad))
  const y = (v: number) => pad + (1 - (v - lo + (hi === lo ? spanY / 2 : 0)) / spanY) * (height - 2 * pad)
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="none">
      <line className="chart__axis" x1="0" x2={width} y1={height - 1} y2={height - 1} />
      {series.map((s, i) =>
        s.dots ? (
          <g key={i} className={`chart__dots chart--${s.tone}`}>
            {s.points.map((p) => (
              <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="3" />
            ))}
          </g>
        ) : (
          <g key={i} className={`chart--${s.tone}`}>
            <polyline className="chart__line" fill="none" points={s.points.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} />
            {s.points.length === 1 && <circle cx={x(s.points[0].date)} cy={y(s.points[0].value)} r="3.5" className="chart__point" />}
          </g>
        ),
      )}
    </svg>
  )
}

/** A small trend line of week scores (3.09). */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v !== null)
  if (pts.length < 2) return null
  const w = 140
  const h = 28
  const lo = Math.min(...pts.map((p) => p.v))
  const hi = Math.max(...pts.map((p) => p.v))
  const x = (i: number) => 3 + (i / Math.max(1, values.length - 1)) * (w - 6)
  const y = (v: number) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (h - 6)
  const last = pts[pts.length - 1]
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline fill="none" points={pts.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')} />
      <circle cx={x(last.i)} cy={y(last.v)} r="3.5" />
    </svg>
  )
}

/** Seven days of bars with an optional band and dashed target, or a limit line (3.09). */
export function WeekBars({
  days,
  max,
  band,
  target,
  limit,
  label,
}: {
  days: { key: string; value?: number; tone: 'in' | 'out' | 'none' }[]
  max: number
  band?: { low: number; high: number }
  target?: number
  limit?: number
  label: string
}) {
  const width = 318
  const height = 130
  const slot = width / days.length
  const bar = Math.min(30, slot - 12)
  const y = (v: number) => height - (Math.max(0, Math.min(v, max)) / max) * height
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {band && <rect className="chart__band" x="0" width={width} y={y(band.high)} height={y(band.low) - y(band.high)} />}
      {target !== undefined && <line className="chart__target" x1="0" x2={width} y1={y(target)} y2={y(target)} />}
      {days.map((d, i) => {
        const x = i * slot + (slot - bar) / 2
        if (d.tone === 'none' || d.value === undefined) return <rect key={d.key} className="chart__empty" x={x} y={height - 24} width={bar} height="24" rx="6" />
        const top = y(d.value)
        return <rect key={d.key} className={d.tone === 'in' ? 'chart__bar' : 'chart__bar chart__bar--out'} x={x} y={top} width={bar} height={Math.max(4, height - top)} rx="6" />
      })}
      {limit !== undefined && <line className="chart__limit" x1="0" x2={width} y1={y(limit)} y2={y(limit)} />}
    </svg>
  )
}

/** Day initials under a seven-day chart, Sunday first (D-012). */
export function DayLabels({ labels }: { labels: string[] }) {
  return (
    <div className="day-labels" aria-hidden="true">
      {labels.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  )
}

/** One row of seven dots: filled at target, ringed below, faint when not logged (3.09). */
export function DotRow({ label, days }: { label: string; days: ('at' | 'below' | 'none')[] }) {
  return (
    <div className="dot-row">
      <span className="dot-row__label">{label}</span>
      <div className="dot-row__dots">
        {days.map((d, i) => (
          <span key={i} className="dot-row__slot">
            <span className={`dot dot--${d}`} />
          </span>
        ))}
      </div>
    </div>
  )
}
