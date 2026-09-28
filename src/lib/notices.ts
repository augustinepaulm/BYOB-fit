// Where the not-advice banner shows (D-041): everywhere but onboarding, whose
// step 3 safety notice already covers it.

export function showDisclaimerOn(pathname: string): boolean {
  return pathname !== '/welcome'
}
