// The D-029 safety notice: one copy of the approved wording, shown in
// onboarding step 3 (1c) and from Settings (5j, EXEC-11 task 5).

export const SAFETY_TITLE = 'Before you start'

export const SAFETY_NOTICE =
  'BYOB-fit is not medical advice. Check with a doctor or physiotherapist before starting a new training program if you have a heart, lung, bone or joint condition, take medicine for your heart or blood pressure, are pregnant, are recovering from an injury or surgery, or have felt chest pain, dizziness or faintness during exercise.'

export const SAFETY_STOP =
  'During any workout, stop if you feel chest pain, severe breathlessness, dizziness or sharp pain.'

/** The two paragraphs under the title. */
export function SafetyNotice() {
  return (
    <>
      <div className="ob-notice">{SAFETY_NOTICE}</div>
      <div className="ob-notice ob-notice--stop">{SAFETY_STOP}</div>
    </>
  )
}
