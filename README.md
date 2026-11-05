# PokéFC Simulation Lab

**Public, non-production research and testing repository** for the private game [`cliffslunchclub/PokeFC`](https://github.com/cliffslunchclub/PokeFC). The playable public alpha is [pfc.cliffslunchclub.com](https://pfc.cliffslunchclub.com/), **not** GitHub Pages.

Updated 2026-11-05. See [RESEARCH_TODO.md](RESEARCH_TODO.md) for current experiments and unimplemented items.

## Purpose and boundaries

This repository runs/reproduces isolated soccer simulation, calibration, viewer feasibility and public browser tests. It contains research helpers, verified test inputs where available, and an original MIT-licensed TacticMesh reference tree. It is **not** the app, a second official game engine, a Pokémon account backend, or an alternative public Soccer-JS game page.

Do not publish private PokeFC Quick Sim source, SiteGround credentials, private user fixtures or browser local-save data here. Native research outputs are never assumed to be authoritative PokeFC gameplay outcomes.

## Implemented research capabilities

| Area | What exists | Important limit |
| --- | --- | --- |
| TacticMesh reference | Baseline engine integration, native full-match/checkpoint helpers, calibration scripts and GitHub Actions workflows | Tests characterize **TacticMesh**, not the final Quick Sim model; baseline is exploratory |
| Comparisons | Scripts and workflow paths for matched Quick Sim/TacticMesh reference comparisons and report summarization | Source fixtures and valid statistical ground truth must be audited before calibration claims |
| Match continuation | Reference checkpoint/handoff smoke checks | Not proof of production cross-engine mid-match tactical resumption |
| Soccer-JS feasibility | Public experimental branches for isometric rendering, knockout-periods, Pokémon sprite loading and 90-minute replay/Watch → Sim handoff | These are prototypes. **No verified native visual engine has been promoted from a public branch to PokeFC `main`** |
| Browser artifacts | Public workflow runs and screenshots demonstrating earlier native Soccer-JS rendering and an immutable Quick Sim result replay | Older screenshots do **not** validate the newest inline viewer integration |

The earlier public proof was in [this native Soccer-JS run](https://github.com/cliffslunchclub/pokefc-simulation/actions/runs/41965539911) and [this Watch → Sim handoff run](https://github.com/cliffslunchclub/pokefc-simulation/actions/runs/41968855684), both from experimental branches. Artifact retention is limited by GitHub; preserve reports and test sources before pruning branches.

## Current project architecture

- Product `PokeFC/main`: Quick Play, Challenges and Gen I–IV 32-Gym Franchise with Quick Sim and legacy TacticMesh Watch.
- Product draft [PR #21](https://github.com/cliffslunchclub/PokeFC/pull/21): **Soccer-JS 2.5D** is being connected to the real Quick Play match screen, with Quick Sim-authoritative results. **Unmerged; not live.**
- Planned: full natural Match Director, complete player/ball sequences, in-game tactical changes via resumable Quick Sim, Challenge/Franchise Soccer-JS parity, and eventual TacticMesh removal.

**Soccer-JS GitHub Pages demo is retired.** Its separate `gh-pages` hosting was a development proof, not a fourth game route. The necessary embedded Soccer-JS `index.html` is in the private draft and must be preserved until replaced.

## How to use this repo

- Select a relevant existing workflow in **Actions** and use `workflow_dispatch` only for a defined test. Some full-match jobs are resource intensive.
- For local reproduction, inspect `scripts/`, `engines/`, `config/` and the corresponding workflow YAMLs. Use a local Node/Python environment where required.
- Keep heavy browser/renderer tests **public**, but share only non-sensitive fixtures and test harnesses. Don't automatically trigger expensive private GitHub Actions.
- Preserve upstream MIT licenses and third-party notices; Pokémon artwork and sprite rights require separate review.

The repository previously included step-by-step instructions to create a new repo. Those are obsolete because both repositories already exist.

## Maintenance

[Research TODO](RESEARCH_TODO.md) · [Cleanup policy](docs/REPOSITORY_CLEANUP.md) · [Watched-match controls notes](docs/watched-match-controls.md)

This repository has no official affiliation with The Pokémon Company, Nintendo, FIFA/EA or the Soccer-JS authors.
