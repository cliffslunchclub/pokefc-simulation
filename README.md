# PokéFC — Public Development and Testing Mirror

This is the **public development/testing mirror** of [cliffslunchclub/PokeFC](https://github.com/cliffslunchclub/PokeFC), the private production repository.

## What's included

- PokéFC Sim Engine (PSE), including `assets/js/quick-sim.js`, shared match rules and positional ratings.
- Quick Play, Challenges, Franchise, formation builder, match reports, calibration data and regression tests.
- Soccer-JS 2.5D Watch integration and a build of its pinned MIT-licensed upstream renderer.

**This repository must not deploy PokéFC.** It has no SiteGround publishing jobs, production credentials, private Git history, or automation that writes to the private production repository. The production site at https://pfc.cliffslunchclub.com is deployed **only from the private repository**.

## Snapshot

Initial source copied from private `PokeFC/main` at commit `31b87aafa528b0747a67f7e9d74a22174b8fba5a` (2026-11-06). The mirror is a sanitized source snapshot, **not a full Git clone** and not a backup of the private repository's history.

The old public TacticMesh research code remains in earlier Git history. It is not part of the current `main` source tree and its old workflows are retired.

## Development flow

1. Make a public feature branch and pull request. Run public PSE, gameplay, UI, native Watch and browser tests.
2. Review and merge tested development changes into this public repository.
3. Separately approve and transfer the relevant source changes into the private production repo.
4. Run final production checks and deploy exclusively from the private repository.

Public PRs and GitHub Actions must not receive FTPS credentials, GitHub personal-access tokens, production environment files, or private saved-game exports.

## Run locally

Node.js 22+, Python 3, and (for native Watch testing) Git/npm are recommended.

```sh
node tests/test-node.cjs
node tests/test-national-dex.cjs
node tests/test-pse-knockout.cjs
node tests/test-challenge-v1-flow.cjs
node watch/soccerjs/test-possession-continuity.cjs
bash scripts/build-siteground.sh
python3 -m http.server 8765 --directory dist
```

The historical `scripts/build-siteground.sh` is **a local static packaging script only**. Running it does not upload files or connect to SiteGround. The public Actions workflows never deploy to a website.

For the native Watch renderer, use `bash watch/soccerjs/build-local.sh` and the manual **Watch browser QA** action. CI will validate all game modes without a production upload.

## Security and ownership

Read [SECURITY.md](SECURITY.md) and [RIGHTS_AND_ATTRIBUTION.md](RIGHTS_AND_ATTRIBUTION.md) before contributing. Public visibility does not automatically authorize reuse of original PokéFC source or Pokémon-related intellectual property. The game is an unofficial fan project, not affiliated with Nintendo, The Pokémon Company, Creatures Inc. or GAME FREAK.
