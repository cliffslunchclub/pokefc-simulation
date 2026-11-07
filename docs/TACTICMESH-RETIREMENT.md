# TacticMesh retirement checklist
Updated November 5, 2026. **Retired and deployed:** PR #60 merged and SiteGround deployment #184 successfully removed legacy runtime files.

Implemented in merged PR #60: remove active TacticMesh selectors in Quick Play/Franchise, hybrid handoff and TM worker/bridge/vendor, old v0.5/v0.7 source duplicates, and TM-focused CI tests. Maintain PSE official outcomes, Soccer-JS 2.5D across all modes, optional Franchise Quick Sim schematic, existing save formats, Watch → Sim record-once and cancel.

## Release gates
1. Pass Play, Challenge, Franchise, PSE events, knockout, replay, fullscreen, package-allowlist and no-TM regression CI checks.
2. Real desktop/mobile smoke across three modes, including 90–120′ replay, 2.5D and schematic view, Sim to End, one-time save and cancel.
3. Build `PFC_INCLUDE_SOCCERJS=1 bash scripts/build-siteground.sh` must contain no TM worker/bridge/vendor/hybrid.
4. Confirm the successful FTPS upload step on the `main` deployment workflow after merge.
5. Confirm that old `/play/tacticmesh/`, `/franchise/tacticmesh/` and worker URLs are gone or clean them *only* within PFC's SiteGround subdomain. A repo deletion does not automatically establish remote deletion.
6. Preserve known-good merge commit for revert; never silently reintroduce TM to bypass PSE tests.

Prior TM source remains available in Git history. Calibration datasets retained where useful.

## Verified release
- Five PR regression workflows passed, including native Chromium desktop/mobile checks.
- [SiteGround deployment #184](https://github.com/cliffslunchclub/PokeFC/actions/runs/42155722741) log confirmed the old worker/hybrid files and both TM vendor folders were deleted; FTPS reported "Sync complete".
- PSE and Soccer-JS stay authoritative and present respectively. Full Git history retains the TM source if future archaeological research is required.
