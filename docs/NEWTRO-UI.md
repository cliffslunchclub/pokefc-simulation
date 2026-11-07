# PokéFC newtro visual system (2026-11-05)

**Identity:** Poké Ball red, white and black, retro game character with a clean modern sports-broadcast interface. All-22 Pokémon is a **reference for hierarchy and information density**, not a source of copied code or art.

## Colors
- Primary red: `#e53935` (primary actions, active tabs, score highlights)
- Hover red: `#ff514d`
- White: `#f7f7f5` (titles, data)
- Black: `#0b0d10` (background)
- Raised panels: `#17191e`, `#21242a`
- Border: `#41454e`; muted type: `#bac0c9`

**Exceptions:** The pitch stays green to preserve field legibility. Red/white team markers in Watch retain their distinct identities. Status/warning colors must remain semantically distinguishable where necessary.

## UI geometry
- Main public content container: 1240px, 24px desktop / 14px mobile gutters.
- Shared panel corner radius: 12px.
- Form controls and standard buttons: 42px minimum height.
- Panel and floating-window titlebars: 52px minimum height, red leading stripe.
- Desktop floating Pokémon picker and Item Shop: both 440px wide, max 82dvh / 760px; matching titlebar heights.
- Below 761px, preserve Challenges' dedicated mobile fullscreen picker and bottom Item Shop sheet instead of imposing desktop floating geometry.
- Large results and detail dialogs retain their existing larger widths; only the two independently movable floating windows match exactly.

## Scope and compatibility
`newtro.css` is intentionally the **last CSS file** on all five public pages. Historic CSS remains for layout and working mechanics. The final stylesheet overrides cosmetic properties and explicitly scoped desktop window sizes; it does not alter PSE, saves, match outcomes, or Watch bridge logic. Every HTML page uses `favicon.svg?v=2` to bust the old icon cache.

`scripts/build-siteground.sh` packages the stylesheet, verifies its link and favicon, and CI checks `tests/test-newtro-ui.cjs`. Do not deploy until the PR passes tests and has been browser-reviewed at desktop/tablet/mobile widths.

## UI QA checklist
1. Home/Builder: aligned field/scouting columns and no horizontal overflow at 320, 375, 768, 1280px.
2. Quick Play: setup and scoreboard fit; Match Center controls, timeline, Watch iframe and Sim-to-End remain accessible.
3. Challenges: launcher, draft picker, slot reels, shop, boss preview, end-of-run dialogs, local leaderboard, drag and keyboard work.
4. Franchise: dashboard, roster table, league navigation, draft controls, and the Watch scorebug fit and scroll.
5. Shared masthead/active-tab states, focus outlines, contrast, and reduced-motion preference behave consistently.
6. Confirm fresh red/white/black favicon in tabs and mastheads; clear cached CSS before judging visual changes.
