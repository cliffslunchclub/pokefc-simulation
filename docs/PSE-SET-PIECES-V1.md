# ARCHIVED — PSE experimental set-piece rules v1 (RETIRED)

**Status:** Retired. Superseded by [enclosed pitch rules](POKEFC-ENCLOSED-PITCH.md). This is historical documentation, not executable guidance. Original status: Opt-in prototype only. Not enabled in Quick Play, Challenges or Franchise until match report, Watch bridge, Soccer-JS and save-schema migrations are verified.

## Design principle
PSE alone produces authoritative events. The Watch / Match Director may interpolate movement but must never claim a corner, foul, free kick or penalty occurred unless PSE recorded it.

## Prototype in `quick-sim.js`
Call `FXI_QUICK.simulate(fixture, { seed, setPieces: 'v1' })`. Omitting `setPieces` retains the **legacy result schema and seeded behavior**. Set-piece sampling uses an independent seeded stream.

- A simulated missed shot may be deflected for a corner; a goalkeeper save may produce a corner. Corners are linked to the PSE shot branch, not fabricated by Watch.
- Failed tackle attempts can produce fouls, which award free kicks or (rarely) regulation penalty kicks. Teams and players receive exact aggregate counts.
- A regulation penalty is an actual shot with `outcome: goal | saved | off-target`; shots on target, saves, player box, goals and final score are updated as one transaction. Its `penalty-kick` event and any associated goal/save event share a timestamp and player identities.
- Event types: `corner`, `foul`, `free-kick`, `penalty-kick`, with existing `goal` and `save`. Every new event has `origin: 'quick-sim'`, `ruleset: 'set-pieces-v1'`, a match minute and player/team identifier.
- New team fields: `corners`, `foulsCommitted`, `freeKicks`, `penaltyKicks`. New box fields: `cornersTaken`, `freeKicksTaken`, `penaltiesTaken`, `penaltiesScored`.

**Limitations:** This is a provisional statistical ruleset, not calibrated pitch-position physics. It models free-kick awards without direct free-kick shots or tactical restarts. Corner and penalty rates need multi-seed calibration. Normal shot attempts still lack their own official timestamps. Do not label their animations official. No substitutions, red cards or injury logic yet.

## Before enabling in modes
1. Make the authoritative incident schema forward-compatible, with stable event IDs and causal links (shot → corner, foul → free kick / penalty → attempt outcome), and migrate reports without reinterpreting old saves.
2. Update the Watch export/bridge to validate and forward these **recorded** event classes. The Match Director should visualize these timestamps with no new result RNG.
3. Update Challenge/Franchise match reports, official stat tables and completion modals. Validate Watch→Sim, cancel, idempotent record and old local-save loading.
4. Add browser tests of corner and penalty poses, keeper saves, camera and clock pacing; test desktop and mobile.
5. Calibrate foul, corner and penalty distributions against a sufficiently broad football reference set. Do not use one TacticMesh half as a full-match target.
6. Treat extra time and shootouts as a **separate shared PSE knockout-rules phase**. Challenges currently stores provisional modeled attempts; Franchise uses a seeded tiebreak without a kick ledger. Neither should be mislabeled a full official PSE shootout.

## Required invariants
- Goals in the match ledger equal the final regulation score.
- Team and player shot totals match; `shotsOnTarget = goals + opposing keeper saves`.
- Each team's corner/free-kick/penalty attempt counts match its players' box counts.
- The same seed and ruleset reproduce identical events and outcomes.
- Legacy `setPieces`-omitted calls remain unchanged.
- Shootout goals stay outside match score, regulation goals, and regulation shot totals when the future shootout engine is integrated.

The opt-in 500-match regression suite is `tests/test-pse-set-pieces.cjs`. It is not a gameplay approval or deployment verification.
