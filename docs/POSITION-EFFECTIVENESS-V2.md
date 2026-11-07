# Competitive v2 — Pokémon base-stat position ratings and finishing

## Scope
Quick Play and Challenges (instant Quick Sim, Soccer-JS Watch, extra time and penalty shootouts) opt in with `{positionEffectiveness:'v2'}`. Franchise uses the existing saved-player model, and unflagged/v1 PSE results remain backward-compatible.

## Original Pokémon attributes
Effective HP, ATK, DEF, SpA, SpD, SPE (including held items and Mega/Primal effects) are the position and finishing inputs. Original Pokédex BST is **not added** separately to position ratings.

## Nine weighted positional fits
Each fit is `min(100, 20 + 0.55 × weighted effective stats)`. Groups and percentages:

| Group | Stat weights | Slots |
|---|---|---|
| GK | DEF 30, SpD 30, HP 20, SPE 20 | GK |
| CB | DEF 45, HP 25, SpD 20, ATK 10 | CB |
| FB | SPE 40, DEF 35, HP 15, SpD 10 | LB/RB |
| WB | SPE 40, DEF 25, SpA 20, ATK 15 | LWB/RWB and LM/RM wide support |
| CDM | DEF 35, SpD 30, HP 20, SpA 15 | CDM |
| CM | HP 20, SPE 20, ATK 15, DEF 15, SpA 15, SpD 15 | CM |
| CAM | SpA 40, SPE 25, ATK 20, SpD 15 | CAM |
| WING | SPE 40, ATK 25, SpA 25, HP 10 | LW/RW |
| ST | ATK 45, SPE 25, SpA 20, HP 10 | ST |

Challenge uses S ≥85, A ≥75, B ≥65, C ≥55, D below 55; public Free Builder aligns to these tiers. Tier letters represent suitability, never an extra match boost.

## Competitive efficiency
Gap = highest fit across nine categories minus assigned fit (at least zero). Efficiency by piecewise-linear interpolation:

| Gap | Efficiency |
|---|---|
| 0 | 100% |
| 5 | 97% |
| 10 | 92% |
| 15 | 85% |
| 20 | 78% |
| 25 | 74% |
| ≥30 | 70% |

Weak Pokémon at their best position can still have 100% efficiency. Position fit and efficiency are **not** the same measure.

## Finishing and scoring
`finishingIndex = 0.45 × ATK + 0.25 × SpA + 0.30 × (BST / 6)`, where effective BST is the sum of six effective stats. This is a relative index, not a direct scoring probability or an extra boost to positional fit. In PSE v2, shot selection still favors forwards, but any outfield position can score. Team shot chances also depend on attack/defense positional fits, and shot conversion depends on finishing, goalkeeper strength, and existing calibrated PSE parameters.

## Compatibility and test coverage
- The v2 engine reads the six effective Pokémon stats, exact assigned slot and competitive position metadata. The Quick Play/Challenge v2 previews no longer generate TM-style `main/detail` adapters; Soccer-JS and match reports do not consume them. The older PSE unflagged/v1 and Franchise paths still support the historical `main/detail` format, which must not be removed without a separate migration.
- PSE saves official goals, shots, saves, deterministic event ledgers; Soccer-JS is a viewer only. Enclosed pitch still has no in-match set pieces.
- Test 2,000 seeded matches, realistic position swaps, fit formulas, Competitive penalties, and 120-minute knockout/shootout parity; maintain default/v1 baseline regressions and packaging smoke tests.
- Franchise player development, position familiarity, and Pokédollars are deferred to Issue #61.

## Formation UI
The Free Builder, Challenges formation/preview cards, and Quick Play locked-XI preview show each Pokémon's S–D position tier alongside rounded Competitive match efficiency (for example, `A · 92%`). The percentage is calculated from the same effective Pokémon stats, role and held items used by PSE; hidden numerical position-fit ratings are not exposed on these cards.
