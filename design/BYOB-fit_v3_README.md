# Handoff: BYOB-fit v3 design (brief v3.0)

## Overview
Full visual redesign of BYOB-fit, the free, open-source workout app installed to the home screen from the browser. It covers Train (Today, workout deck, Week), Meals, Body, Progress (Training, Nutrition, Body scores), Profile and Settings, and onboarding. Each screen comes in light and dark, along with empty, loading, error, offline and keyboard states. Approved Oct 3, 2026.

## About the design files
`BYOB-fit_v3_design.html` is a **design reference built in HTML**. It is not production code. Rebuild these screens in the BYOB-fit codebase using its existing patterns. Open the file in a browser; it is a pan-and-zoom canvas of 390 × 844 frames. Each frame has an id: 2.xx is Train, 3.xx and 1a to 1l are round 3 and onboarding, 4.xx is states, and frames under "Dark" are the dark versions. All data is placeholder (brief section 8, plus the made-up values listed at the end of each section).

The mockup loads its fonts from Google Fonts for preview only. **The app must bundle the font files itself.** The security policy allows only fonts served by the app.

## Fidelity
High fidelity. Colours, type, radii, spacing and copy are final. Copy rules: sentence case, no exclamation marks, no em dashes.

## Design tokens
Light (ground fixed by the brief):
- ground `#f5f2ec`, sheet/card `#fdfcf9`, field `#f1efe9`, chip `#ebe6dc`, line `#e6e0d4`
- ink `#1f1d1a`, ink 2 `#66615a`, muted `#8a847a` (non-essential only)
- sage (accent, done, primary) `#3d6b5a`; sage text on tint `#2f5546`; sage tint `#e6ede8`; sage soft (chart secondary) `#a9c1b5`; ring track `#dde6df`
- navy (brand wordmark, AI marks) `#1f3a5f`; AI tint `#e3e8f0`; tab bar `#1f3a5f` with inactive labels `#b4c0d0` and active `#fdfcf9`
- warning `#8a5a00` on `#f5ead6`; danger `#a8322a` on `#f6e4e1`

Dark:
- ground `#161816`, sheet `#212421`, field `#2a2d29`, chip `#2c2f2b`, line `#33362f`
- ink `#ecebe6`, ink 2 `#a9aaa2`
- sage `#8cc2aa`; sage text `#9fd0b9`; tint `#24352d`; soft `#4f6e60`
- brand and AI `#a9c2e6` on `#22304a`; tab bar `#2a4a73`
- warning `#e0b25c` on `#3a2f1c`; danger `#f08a7e` on `#3d2421`
- Text and ticks on sage fills switch to `#0f1a15` in dark (white in light).

Contrast ratios in the file are estimates. Check them with a contrast tool before building.

Radii: card 24, sheet top 28, row/field 12–20, pills full. Shadows are soft only (card `0 1px 2px rgba(0,0,0,.06)`, active row `0 10px 24px -10px rgba(40,34,24,.22)`).

## Typography
- **Bricolage Grotesque** (SIL OFL 1.1): titles, numerals, scores, timers. Weights 600 and 700. Wordmark uses 800 at width 78%.
- **Atkinson Hyperlegible** (SIL OFL 1.1): all UI and body text. Weights 400 and 700. Its slashed zero is kept.
- Both fonts can be redistributed inside the MIT repo. Ship each with its OFL.txt, as self-hosted woff2 files.
- Scale: 36/30/26/22 titles; 16 body; 15 secondary; 13 captions; 11 tab labels; numerals 20–44, score 32 inside a 118 px ring.

## Buttons (one hierarchy only)
- Primary: sage fill, white text, 50 px tall, pill.
- Secondary: sage tint fill, sage text.
- Tertiary: text only, sage text, 44 px tap area.
- Destructive: danger text, or danger-tint fill in dialogs.
- Chip: `#ebe6dc` pill, 44 px tall; selected is a sage fill with a tick.
- Minimum tap target is 44 px everywhere.

## Layout rules
- Fixed header on every app screen: status bar (50), a brand row (40) with context text on the left and the centred BYOB-fit wordmark (the O drawn as a weight plate), then a context row (44): title or segmented control, plus a right-hand action. Content scrolls underneath it.
- Tab bar: navy, 80 px including the safe area. Glyph plus label. Shown on every screen, including inside a workout. It hides while the keyboard is open.
- In-progress bar: sage, 60 px, above the tab bar on other tabs ("Upper B · rest 1:42", Return). Tapping it returns to the deck where you left off.
- Keyboard open: the active set row or meal field stays above the screen midline.

## Interactions and motion
- Set tick: the circle fills sage and the row eases to tint over 180 ms.
- Rest ring: drains continuously.
- Sheets: rise over 240 ms.
- Reduce motion: changes happen instantly, the rest ring steps once per second, and sheets cross-fade over 120 ms.
- Any AI call first opens a send preview listing exactly what will be sent.
- AI-supplied values carry an "AI estimate" tag (navy).

## Scores
Follow `docs/SCORES.md`. The screens show its weights (training 40/30/30) and bands (calories at target ±10%; fibre 14 g per 1,000 kcal; saturated fat 10% of logged calories). The three scores are never combined. A part with missing data is named, never shown as zero; the score is re-weighted as SCORES.md Part 1 rule 5 describes.

**Open item:** the placeholder goal ("lose body fat, then build muscle") gives a training score of 85 under SCORES.md, but the mock shows 76, as brief section 8 does. Decide which one is right before writing tests.

## Assets
There are no images. All icons and charts are inline SVG or CSS shapes. The wordmark is CSS type plus a ring and is a placeholder until a final logo exists.

## Files
- `BYOB-fit_v3_design.html`: self-contained design canvas (all rounds, light and dark).
