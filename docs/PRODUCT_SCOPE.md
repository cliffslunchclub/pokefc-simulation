# PokéFC product scope and compatibility

Updated November 5, 2026. Track future work in [DEVELOPMENT_TODO](../DEVELOPMENT_TODO.md).

## Architecture
- PokéFC Sim Engine (PSE in `quick-sim.js`) is authoritative for score, official incident ledger, stats and saves. **Quick Sim** is the instant-simulation button.
- Soccer-JS is the sole 2.5D Watch renderer in Quick Play, Challenges and Franchise; movement between official incidents is illustrative.
- Watch → Sim to End applies an already locked PSE outcome once; no Sim → Watch. Cancelled Watch sessions do not save official results.
- Knockout matches support official 120-minute extra time and shootouts. PR #62 adopts an enclosed pitch with continuous play and no standard in-match set pieces.

## Modes and data
- Home / Free XI Builder: Gen I–IX National Dex, 1,025 species, Pokémon sprites and position-based grades.
- Challenges: Classic Gen I–IV or National Gen I–IX, draft an XI and equipment for six opponents (Lorelei, Bruno, Agatha, Lance, Blue, Red); local records and automatic one-run-per-division resume.
- Franchise: Gen I–IV 493 species and 32 gyms, 22 league games per club, 16-team playoffs, 25 senior plus up to 10 Practice Squad Pokémon. Save/restore career JSON and browser state, including previous `FXI_*` APIs and `PokeFC-v08-<seed>.json` export conventions, must remain compatible.
- A separate Soccer-JS manual-control Arcade experiment is not a shipped fourth mode.

## Future work
- Deterministic resumable PSE for halftime and arbitrary-minute tactical changes.
- Position effectiveness, efficiency balancing, development resources and XP progression in Franchise.
- More natural long-match animations, mobile performance/accessibility, alternate forms and verified online leaderboards.
