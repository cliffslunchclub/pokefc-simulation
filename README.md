# PokéFC — public development and testing mirror

This repository contains the **public development and test snapshot** of PokéFC, including the PokéFC Sim Engine (PSE), Soccer-JS 2.5D Watch, Quick Play, Challenges, Franchise, and the test suites.

**Live website:** https://pfc.cliffslunchclub.com/  
**Private release repository:** `cliffslunchclub/PokeFC` (the only production deployment source).  
**Mirror baseline:** private `main` at `31b87aafa528b0747a67f7e9d74a22174b8fba5a` (2026-11-06).  
**Purpose:** develop and test here, then manually promote verified patches to the private release repository.

## Security boundary

- **No SiteGround credentials**, FTPS publisher, private secrets, production deployment workflows, or private Git history belong in this repository.
- Public GitHub Actions may test source and upload **non-sensitive** test reports only. They cannot publish the production site.
- Run tests on public PRs/branches. Only transfer reviewed code to private `PokeFC` after passing all applicable checks.
- A public mirror does not automatically sync back to the private repository. Promotion is an explicit, reviewed step.
- Never upload customer information, local game saves, real-world identities, private fixtures, or authentication tokens into code, issues, tests, screenshots, or artifacts.

## Components

- `assets/js/quick-sim.js` — authoritative PokéFC Sim Engine (PSE).
- `assets/js/position-effectiveness.js` — position effectiveness using Pokémon base statistics.
- `play/`, `challenge/`, `franchise/` — three game modes.
- `watch/soccerjs/` — deterministic visual Watch of official PSE outcomes.
- `tests/` and `watch/soccerjs/test-*.cjs` — gameplay, unit, regression and browser tests.
- `scripts/build-siteground.sh` — **local package validation only in this repository**. This script does not publish anything; the FTPS deployment workflow is deliberately absent.

## Testing

Open **Actions → PokéFC Public Regression Tests** on a branch or PR for PSE, UI, Challenges, Franchise, and Watch checks.

Use **Actions → PokéFC Browser and Native Watch Tests** for real Chromium and Soccer-JS packaging tests. The latter downloads a pinned, MIT-licensed upstream Soccer-JS revision, builds a temporary test bundle, and does not deploy it.

For individual local checks: `node tests/test-play.cjs` or `node watch/soccerjs/test-goal-defense.cjs`. See `docs/PUBLIC_TESTING_AND_PROMOTION.md`.

## Intellectual property and notices

Original PokéFC source is publicly viewable but is **not automatically licensed** for copying or redistribution. Pokémon names, designs, game art, sprites, and other Pokémon-related intellectual property are not owned or licensed by this repository. Sprite URLs reference third-party PokeAPI artwork, which may have separate rights restrictions. Soccer-JS is MIT-licensed and its original license must remain with any redistributed upstream code or generated bundle. See `THIRD_PARTY_NOTICES.md`.

PokéFC is an unofficial fan project and is not affiliated with, sponsored by, or endorsed by Nintendo, Game Freak, Creatures, or The Pokémon Company.

**Source code appearing publicly does not make its artwork or trademarks open source.**
