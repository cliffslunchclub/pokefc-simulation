# Soccer-JS Watch rebuild — consolidated PokeFC plan
Updated: 2026-11-05

## Status
- **Merged:** PR #21 was squashed into `main` as `09882aab4e1ed5fa0d5e22be1829db254f17ed49`. The SiteGround CI build and FTPS deployment [passed](https://github.com/cliffslunchclub/PokeFC/actions/runs/42084226872). Quick Play's isometric 2.5D Watch remains **opt-in** via `?watch=soccerjs`; normal Watch remains TacticMesh.
- Closed, unmerged source PR: https://github.com/cliffslunchclub/PokeFC/pull/11
- Preserved source branch: `experiment/phase10-soccerjs-private-staging`; do **not** delete until the new implementation is verified.
- The completed rebuild branch was merged; the archived historical experiment remains preserved. Do not confuse the opt-in Quick Play rollout with completed Challenges/Franchise integration.
- Heavy browser/engine tests belong in public `cliffslunchclub/pokefc-simulation`. Never publish private Quick Sim source or sensitive fixtures; do not enable heavy private Actions runs.

## Final architecture
1. **Quick Sim** is the exclusive authority for score, player statistics and saved match outcome across Quick Play, Challenges and Franchise. Lock a complete result before entering the initial Watch presentation.
2. **Match Director** produces deterministic visual events from official match data; label reconstructed shots/passes/movement illustrative. Do not invent official statistics or modify the locked result.
3. **Soccer-JS 2.5D** is the **eventual default** Watch renderer in all three modes. Today it is only opt-in for Quick Play; it must not independently determine scores.
4. **Watch → Sim to End** is allowed at any minute and reveals the same authoritative result. Record exactly once; cancel must not mutate game state. No mid-match Sim → Watch.
5. Pokémon sprites use original game artwork, normalized at ~72 px in the experiment, with red home/white away Poké Ball-style numbered badges and carrier-only player names.
6. **TacticMesh removal** is the latest target decision. Existing TacticMesh must remain working until Soccer-JS is integrated and validated across game modes. Remove TacticMesh code, fallback UI and related deployment/test hooks in a distinct, reviewed cleanup step, not as an early regression risk.
7. Mid-match tactical changes and resumable Quick Sim are a **future feature**, not currently implemented; evaluate halftime restart first.
8. Fully controlled FIFA-like Arcade Mode remains exploratory and outside this integration branch.

## Small, independently reviewable implementation slices

- [x] Close experimental PR #11; retain its source branch.
- [x] Create clean branch from latest `main`.
- [x] Import the isolated deterministic shot/outcome Match Director at `match-director/timeline.js`.
- [x] Import its original regression test at `tests/test-phase10-director.cjs`.
- [x] Execute the recovered Match Director test against current Quick Sim in isolated V8 (220 seeds); Node CLI rerun remains part of local smoke validation.
- [x] Recover and compile the pinned MIT Soccer-JS renderer, production-allowlist the embedded runtime, and verify actual native 2.5D graphics with [public Chromium results](https://github.com/cliffslunchclub/pokefc-simulation/actions/runs/42082614996). Mobile/performance and broader rights review remain open.
- [x] Stage the guarded Watch bridge with strict fixture checks and same-origin message protocol; 220 additional actual Quick Sim fixtures passed snapshot/scoreAt. **Browser cancel/record-once regression still pending.**
- [x] Add the 2.5D sprite renderer, home red/away white badges and rings, and ball-carrier labels. [22/22 Pokémon sprites rendered](https://github.com/cliffslunchclub/pokefc-simulation/actions/runs/42082614996). Mobile and reduced-motion checks are still pending.
- [x] Merge the gated Quick Play entry (`/play/?watch=soccerjs`) and preserve existing default Watch. Native public fixture browser tests, bridge and real-Quick-Sim lifecycle checks passed; full hosted-site, mobile and knockout tests remain open.
- [ ] Integrate locked Challenge XI and progression without regressing v2 Gauntlet, scouting, item shop or saved results.
- [ ] Integrate Franchise Tactical Viewer and week advancement without duplicate saves.
- [ ] Upgrade Match Director to natural player/ball sequences while preserving official event provenance.
- [ ] Public browser smoke/regression tests and local full-game checks: result consistency, halftime/replay/skip, mobile, shootouts, save compatibility and no duplicate awards/progression.
- [ ] Switch Soccer-JS Watch on by default in all three modes; verify SiteGround build allowlist includes required assets and deploy safely.
- [ ] Remove TacticMesh completely **only after** parity/rollback criteria are met.
- [ ] Delete preserved experimental source branch when new changes are verified and all useful code has been recovered.

## Recovered first slice
`match-director/timeline.js` makes a deterministic read-only shot ledger from a completed Quick Sim fixture. It preserves official scorer/assist/minute and total player/team shots/saves. Other shot times are `derived-from-quick-sim-totals`, not actual events.

Manual local regression from repo root:

```sh
node tests/test-phase10-director.cjs
```

The isolated module and test were copied without integrating them into production files. Their existence on this branch does **not** assert that the test has passed against the current production head.

## Source-of-truth conflict resolution
The old experimental PR documented a *temporary manual TacticMesh fallback*. The newer consolidated design decision supersedes that as the **final product direction** (remove TacticMesh); however, temporarily keeping its working code during migration is necessary to prevent regressions.

Keep new changes narrow and mode-specific; do not merge the old 56-commit experimental PR or delete its branch prematurely.

## Implementation checkpoint — November 5, 2026

The clean branch now contains standalone Soccer-JS source, native-renderer loader, Pokémon badges/sprite helpers, motion generator, fixture exporter/test scripts, bridge, and opt-in Quick Play integration. See [watch/soccerjs/README.md](../watch/soccerjs/README.md) for build steps and validation details.

**Isolated V8 checks** ran the recovered Match Director test against the actual current Quick Sim code: 220 seeded matches, 4,704 shots, 1,863 saves, 450 goals reconciled. A separate 220-fixture Watch bridge check reconciled 4,758 shots and 489 goals, with no result mutation or drift. All relevant JS sources parsed successfully. These are logic checks, **not a visual browser test**.

The normal SiteGround workflow now compiles and publishes the **allowlisted embedded Soccer-JS runtime**, while the 2.5D UI is opt-in and existing game modes remain unchanged. No production feature switch, Franchise/Challenge wiring, private CI or deploy is authorized by these commits.

## Integration milestone — November 5, 2026

- [x] Native public browser replay verified with original Soccer-JS graphics, 22 Pokémon, isometric projection, red/white team indicators, and Watch→Sim/result immutability ([test run](https://github.com/cliffslunchclub/pokefc-simulation/actions/runs/42082614996)).
- [x] PR #21 merged into product `main` as one commit; Quick Play build/lifecycle regressions and compiled SiteGround package [passed](https://github.com/cliffslunchclub/PokeFC/actions/runs/42084226872), including successful FTPS upload.
- [ ] Independent **hosted-site** Chromium smoke and mobile layout checks; GitHub deployment success is not alone proof of how the site renders for every visitor.
- [ ] Integrate and verify Challenges and Franchise, including their save/progression contracts; only then consider enabling Soccer-JS as default and removing TacticMesh.
- [ ] More natural full-match Match Director behavior, seeded resumable tactics, full knockout extra time and shootouts.
