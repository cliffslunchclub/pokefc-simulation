# PokéFC — Unattended simulation benchmark starter

This repo is a **working TacticMesh reference benchmark** and a staging area for cross-engine calibration. TacticMesh was taken from the user-supplied `tacticmesh-main(1).zip` (archive commit comment `603312dcf037bed0b0c817f8ba8a194eaebce8da`). Original TacticMesh source files are intentionally kept unchanged, with its MIT license and third-party notices.

## What is real today

- Six independent, **complete 90-minute TacticMesh reference matches** (45-minute halves), executed as six concurrent GitHub Actions jobs.
- Matrix includes balanced, pressing, possession, direct and native generated-default tactical profiles.
- Native seed replay and checkpoint restore parity smoke checks.
- TacticMesh JSON outputs, aggregated JSON, CSV and a Markdown report, saved as GitHub Actions artifacts.
- A fast `smoke` option to avoid a multi-hour run when checking basic wiring.

## What is not implemented yet

- **20,000 real Quick Sim matches**: the prior custom FUTBOL XI / Quick Sim code was not included in the supplied archive. These are **not** simulated or fabricated.
- Pokémon stats/typing and 25+10 roster are game-level integration work and are **not** applied to the vanilla TacticMesh reference matches here.
- Watch → Sim to End at 15/45/75 minutes: not runnable until both engines share a defined match-state handoff. Native same-engine checkpoint parity is tested independently.
- The aggregate of six matches is an exploratory baseline, not enough to claim reliable goal/outcome calibration.

## Start in GitHub (cloud, so your computer can be off)

1. Create a **new, private, empty** repository such as `cliffslunchclub/pokefc-simulation`. Do not put this in the existing school or homepage repos.
2. Extract the accompanying kit ZIP and upload its files, **including the hidden `.github/workflows/pokefc-calibration.yml` path**, into the repository. Easiest from a local terminal once the empty GitHub repo exists:

```bash
cd /path/to/extracted/pokefc-calibration-repo

git init -b main
git add .
git commit -m "Set up reproducible TacticMesh calibration CI"
git remote add origin https://github.com/cliffslunchclub/pokefc-simulation.git
git push -u origin main
```

3. On GitHub: open **Actions → PokéFC TacticMesh calibration baseline → Run workflow → aggressive**.
4. After completion, open the workflow run → **Artifacts** → `pokefc-reference-report` to download the CSV, JSON and written baseline. Individual reference jobs also retain their detailed JSON files.

The `aggressive` option uses six parallel hosted jobs; it may consume GitHub Actions minutes and is subject to the account's quotas/concurrency. A shut-down PC does not stop an already-started GitHub Actions run.

### One-command Mac alternative

If GitHub CLI (`gh`) is installed and authenticated (`gh auth login`), the included `SETUP_MAC.sh` creates a new private `cliffslunchclub/pokefc-simulation` repository if absent, publishes the source, and **dispatches aggressive workflow**:

```bash
cd /path/to/extracted/pokefc-calibration-repo
bash SETUP_MAC.sh
```

The script never targets the school or homepage repositories. If GitHub Actions cannot be dispatched automatically, it prints the Actions page for a manual start. An active GH CLI session is needed for authentication.

## Run locally

Node.js 22 is sufficient for the included headless simulation and smoke tests. No npm installation is required.

```bash
node scripts/checkpoint-smoke.cjs
mkdir -p results
node engines/tacticmesh/tools/batch.cjs --matches 1 --seed 847291 --half-seconds 90 --out results/smoke.json > /dev/null
# Optional: a full 90-minute match (computationally more expensive)
node engines/tacticmesh/tools/batch.cjs --matches 1 --seed 847291 --half-seconds 2700 --out results/reference-01-balanced.json > /dev/null
node scripts/verify-reference.cjs results/reference-01-balanced.json 847291
node scripts/summarize.cjs results results/summary
```

## Next integration step

Add the real custom FUTBOL XI / Quick Sim source under `engines/quicksim/`. It should accept a fixed integer seed, initial teams/tactics, length, and (for handoffs) a snapshot plus remaining match time. It should export **completed** match metrics using documented semantics for passes, tackles, shots, score, and possession. Only then should CI add a 20,000-match Quick Sim matrix and numeric calibration check. Avoid claiming a win-rate or goal-rate calibration from six slow-engine matches.

## Security and authorship

TacticMesh is authored by Energen Games and distributed under the MIT License; see `engines/tacticmesh/LICENSE` and `engines/tacticmesh/THIRD_PARTY_NOTICES.md`. This starter is not an upstream release. Its extracted `src` and native `tools` content were kept unchanged.
