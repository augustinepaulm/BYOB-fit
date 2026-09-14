import { useState } from 'react'

import { formatLongDate } from '../lib/dates.ts'
import { prescriptionText } from '../lib/prescription.ts'
import { dayForDate, resolveItem } from '../lib/program.ts'
import { useProgram } from '../program/useProgram.ts'
import { RestIcon, SwapIcon } from '../ui/icons.tsx'
import type { Program, Section } from '../types/program.ts'

function SectionCard({
  section,
  program,
  week,
}: {
  section: Section
  program: Program
  week: number
}) {
  if (section.items.length === 0) return null
  const big = section.kind === 'main'
  return (
    <>
      <div className="section-label">{section.title}</div>
      <div className="card">
        {section.items.map((item) => {
          const resolved = resolveItem(item, week)
          const exercise = resolved.exerciseId
            ? program.exercises[resolved.exerciseId]
            : undefined
          const prescription = prescriptionText(resolved)
          return (
            <div className={big ? 'row row--main' : 'row'} key={resolved.id}>
              <div className="row__name">
                <span>{exercise?.name ?? resolved.exerciseId}</span>
                {resolved.index && <span className="index-tag">index</span>}
                {resolved.cue && <span className="row__cue">{resolved.cue}</span>}
              </div>
              {prescription && (
                <span className="row__prescription">{prescription}</span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function TodayScreen() {
  const { program, today, week, weekPlan } = useProgram()
  const [notice, setNotice] = useState(false)

  if (!program) return null

  const day = dayForDate(program, weekPlan, today)
  const scheduled = program.days.find((d) => d.order === today.getDay())
  const swapped = scheduled !== undefined && scheduled.id !== day.id
  const meta = `${formatLongDate(today)} · Week ${week} of ${program.programWeeks}`

  if (day.rest) {
    return (
      <div className="page">
        <div className="page-head">
          <div className="page-head__meta">{meta}</div>
          <h1 className="page-title">Rest day</h1>
        </div>
        <div className="empty">
          <div className="empty__ring">
            <RestIcon />
          </div>
          <div className="empty__title">Nothing scheduled</div>
          <div className="empty__body">
            Recovery counts as training. Daily items live on your next session.
          </div>
        </div>
      </div>
    )
  }

  const aside = [day.focus, day.durationMin ? `about ${day.durationMin} min` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__meta">{meta}</div>
        <div className="page-head__row">
          <h1 className="page-title">{day.name}</h1>
          {aside && <span className="page-head__aside">{aside}</span>}
        </div>
      </div>

      {swapped && scheduled && (
        <div className="banner">
          <SwapIcon />
          <span>Swapped: this is {day.name}&apos;s session</span>
        </div>
      )}

      {day.sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          program={program}
          week={week}
        />
      ))}

      <div className="action-dock">
        <button type="button" className="btn-primary" onClick={() => setNotice(true)}>
          Start
        </button>
        {notice && <div className="notice">Deck arrives in Phase 3</div>}
      </div>
    </div>
  )
}
