# Public testing and private-release promotion

## Two-repository policy

1. **Public `pokefc-simulation`**: all ordinary feature work, PSE and Soccer-JS simulations, unit/integration tests, browser/device checks, and test artifacts. No production credentials or deploy permissions.
2. **Private `PokeFC`**: source of truth for released versions; accepts reviewed patches from the public repo and alone can deploy to the live SiteGround subdomain.

## Mirror baseline

Initial clean-source mirror: private `PokeFC/main` at `31b87aafa528b0747a67f7e9d74a22174b8fba5a`, excluding private history, production workflows, maintenance/deletion scripts, and production documentation.

The initial public repo history predates the mirror and contains obsolete TacticMesh experiments. Those original commits remain public for historical purposes but should not be merged back into new development. The mirror replaces old main-tree contents rather than preserving outdated engines in the active source.

## Safe promotion checklist

- A public PR passes the regression and (where relevant) Chromium Watch checks.
- Review the diff for changes to PSE outcomes, saved-game compatibility, viewer authority, game modes, and licenses.
- Check for secrets and personal data in code, screenshot artifacts, and build outputs.
- Transfer approved code to a fresh **private** release branch as a source patch, not an automatic cross-repo push.
- Run a minimal private package check and verify `dist/` contains the intended five public pages.
- Deploy using the private repo's existing SiteGround workflow **only after release approval**.
- Run live desktop/mobile smoke checks, including official result consistency and Record/Cancel behavior.

Do not configure any public workflow with SiteGround FTPS secrets or a token that can write to the private repository.

## Running tests

Normal pushes and pull requests run public core game, Challenge/UI, and Watch tests.

A separate native browser workflow builds the pinned open-source Soccer-JS renderer and executes the real Chromium Watch scenarios on desktop and mobile. Its output is test-only and does **not** deploy.

If a historically named test becomes obsolete, fix or retire it in a reviewed PR; do not silently suppress new regressions.

## Public IP warning

This is publicly viewable source, **not** an open-source grant to Pokémon artwork, designs, marks, or original PokéFC code. See `THIRD_PARTY_NOTICES.md`.
