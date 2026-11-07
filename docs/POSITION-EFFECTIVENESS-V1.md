# PSE Position Effectiveness v1 — Quick Play and Challenges

## Activation and compatibility
- Enabled only in Quick Play instant Quick Sim / Watch, and Challenges instant Gauntlet / locked Watch. No set-piece behavior is added. Franchise remains legacy pending Issue #61.
- PSE remains the sole authority for official scores, events and statistics; Soccer-JS visualizes outcomes and does not simulate match results.
- Each starting-XI slot uses item-/Mega-/Primal-/Light-Ball-adjusted stats and its actual assigned position to calculate a **positionEfficiency** value.
- Opt-in PSE parameter: `{positionEffectiveness:'v1'}`; default `simulate(preview)` remains bit-for-bit compatible with existing seeded saves/matches.
- There is no schema migration or persisted familiarity yet.

## Natural fit and broad-role ratings
- Fit = `min(100,20 + 0.55 × weighted effective species stats)`.
- Same weights as the existing Challenge role tier: GK (HP20%, DEF30%, SpD30%, SPE20%); DEF (DEF35%, HP20%, ATK20%, SPE25%); MID (SpA30%, SpD25%, ATK20%, SPE25%); FWD (ATK35%, SpA20%, SPE35%, HP10%).
- S ≥85, A ≥75, B ≥65, C ≥55, D below 55. **Tier letters are presentation; no fixed S-tier bonus.**
- Current v1 distinguishes broad role families, not narrower ST/LW/RW or LB/CB/RB specialty; future tuning may add them.

## Penalty and gameplay impact
Relative suitability gap = `max(0, highest of GK/DEF/MID/FWD fits − assigned role fit)`.

`positionEfficiency = max(0.88, 1 − 0.0035 × gap)`, rounded to 4 decimal places.

| Relative fit gap | Efficiency |
|---|---|
| 0 | 100% |
| 10 | 96.5% |
| 20 | 93% |
| 35 or greater | 88% (capped) |

This modest penalty avoids double-paying attributes already present in PSE role strengths. PSE scales role attack/defence/goalkeeper/midfield strengths and individual finishing/tackling / assist weighting. The same opt-in effect is applied to Challenge extra-time and separate official shootouts. No extra RNG draws are added.

## Tests and future scope
- Test neutral 100% effectiveness retains same seeded score, stats and events as legacy.
- Confirm mismatched roles significantly affect aggregate PSE outcomes.
- Confirm Quick Play/Challenges both pass slot metadata, and positional effects persist through 90–120 minute knockout / shootouts, including Watch→Sim-to-End.
- Tune slope/cap after seeded simulations and browser/mobile QA; improve exact-position specialization only if it adds measurable strategic value.
- See GitHub Issue #61 for **future Franchise position familiarity, development/training planner, Pokédollar resource allocation, coaching upgrades and manual XI**.
