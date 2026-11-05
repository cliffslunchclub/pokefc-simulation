# Public PokeFC simulation lab — Research TODO

Updated 2026-11-05. This is **not** the game product roadmap; see private `PokeFC/DEVELOPMENT_TODO.md` for product milestones.

## Research work that exists

- [x] Original TacticMesh reference engine and historical calibration harness/workflow scripts.
- [x] Checkpoint/restore smoke checks and reference full-match test jobs.
- [x] Experimental branches and public browser-test artifacts for Soccer-JS rendering, sprite/2.5D feasibility, Quick Sim result replay and Watch→Sim protocols.
- [x] Public workflow paths for research; no private SiteGround deployment is hosted here.

## To implement or validate

- [ ] Consolidate the **necessary** public Soccer-JS test harness, the relevant reproducible test fixture(s) and MIT licensing from experimental branches onto `main` without publishing private Quick Sim code.
- [ ] Preserve machine-readable results or immutable refs for valuable historical public test runs before deleting test branches.
- [ ] Browser-test the **new inline 2.5D Quick Play** rather than relying on earlier standalone screenshots: start/stop, pause, camera, 0–90', Watch→Sim, cancel, single recording, score/stat/event consistency.
- [ ] Test actual Pokémon sprite visibility/normalization (including Gen V–IX fallback) and touch/small-screen performance.
- [ ] Cross-check goal/event clock, periods, extra time, shootouts and provenance for 90/120-minute fixtures.
- [ ] Audit performance, determinism and calibration representativeness; don't describe illustrative motion as observed match events.
- [x] Retired the obsolete standalone Soccer-JS `gh-pages` content: only `.nojekyll` remains in the branch tree.
- [ ] Disable GitHub Pages in repository Settings when no links need it; branch still exists even though content was pruned.
- [ ] Consolidate/review experimental branches, then delete their refs using a GitHub branch-deletion client or GitHub UI. Don't rewrite `main` or destroy unique unmerged source.
- [ ] Reduce obsolete research workflow duplication only after checking their scripts/results are no longer needed.

## Product work that belongs elsewhere

The **private** PokeFC repo owns the game's actual Quick Sim implementation, mode UIs, results/save contracts, deployed SiteGround packaging, final native renderer integration, and product README. Do not move those sources here.
