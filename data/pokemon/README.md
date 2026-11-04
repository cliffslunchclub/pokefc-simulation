# PokéFC — Gen 1–9 Master Pokémon Database (v0.1)
 
> **Status:** complete base species data, **provisional** soccer ratings. This is the PokéFC game-data workstream, separate from the TacticMesh match engine calibration.

## Database coverage
- All 1,025 National Pokédex species from generations 1 through 9, IDs 1–1025, with one **default species form** per Pokédex number.
- **Franchise:** Pokémon #1–493 (Gen 1–4).
- **Challenge Classic:** #1–493 (Gen 1–4).
- **Challenge National:** #1–1025 (Gen 1–9).
- Legendary and Mythical species have independent flags; mode-dependent restriction toggles can filter them without modifying this database.
- Regional, Mega, Gigantamax and other alternate forms are **not additional species records** in this first version. An expansion table should refer to the parent species ID.

## Files
- `pokemon_master.csv` — 1,025 flat records, original six stats and provisional core six ratings.
- `pokemon_master.json` — equivalent structured records, preserving raw weighted scores alongside rounded ratings.
- `rating_model.json` — the editable source-of-truth for the six 4-stat weighted formulas and temporary normalization.
- `validation.json` — verifiable counts, integrity assertions and sample Pokémon.

## MVP six soccer attributes
Each rating = weighted sum of exactly four Pokémon stats; weights total 100%. Full weights are in `rating_model.json`.

| Soccer attribute | Formula on raw Pokémon base stats |
| --- | --- |
| Pace | Speed 65% + Attack 15% + HP 10% + Special Attack 10% |
| Shooting | Attack 45% + Special Attack 30% + Speed 15% + Special Defense 10% |
| Passing | Special Attack 45% + Special Defense 30% + Speed 15% + Defense 10% |
| Dribbling | Speed 40% + Special Attack 30% + Attack 20% + Special Defense 10% |
| Defending | Defense 45% + Special Defense 30% + Speed 15% + HP 10% |
| Physical | HP 45% + Attack 30% + Defense 15% + Special Defense 10% |

**Temporary mapping to 1–99:** if raw ≤ 80, `round(20 + 0.70×raw)`; otherwise `round(76 + 0.25×(raw-80))`; clamp result to 1–99. This mapping **is not approved as final** and can be replaced by one new model version. No extra BST modifier, individual IVs, age effects, level effects, position Overall or Pokémon type bonus was added. Challenge will eventually use deterministic ratings; Franchise-only variations should remain in individual player/save records, not species data.

## Still to implement
1. Approve and tune exact attribute weights and 1–99 conversion by sample Pokémon and roster distribution.
2. Position suitability/Overall using TacticMesh-compatible position weights; same general attributes are available to goalkeepers, without an invented GK-only save mechanic.
3. Map the six MVP ratings to TacticMesh's detailed active/reserved attributes **only after** specific weights are approved. Do not claim that all 46 are already defined.
4. Build a separately audited form registry and sprite manifest (classic static pixels, animated Showdown where available), with reliable fallback and licensing review.
5. Integrate into franchise/challenge rosters; do not overwrite the engine benchmark fixtures.

## Data sources (PokeAPI CSV snapshot, retrieved 2026-11-03)
- https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv
- https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv
- https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_stats.csv
- https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_types.csv
- https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/types.csv
- https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv

PokéFC is an unofficial fan project. Game content/character images and names have separate intellectual-property considerations; this dataset does not grant redistribution rights to Pokémon assets.
