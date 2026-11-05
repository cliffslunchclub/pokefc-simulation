# Public research repository maintenance — 2026-11-05

The public repository is `cliffslunchclub/pokefc-simulation`; production source is private `cliffslunchclub/PokeFC`.

Before cleanup there were **six refs**: `main`, `gh-pages`, and four experimental branches. The experiment refs are not merged to research `main` and contain source/replay-test work absent from it.

| Branch | Purpose | Deletion condition |
| --- | --- | --- |
| `main` | Public reference workflows and canonical research docs | Keep |
| `gh-pages` | Obsolete standalone Soccer-JS demo distribution | Prune the page; disable Pages in Settings before deleting the branch |
| `experiment/phase10-isometric-match-director` | Isometric Match Director prototype | Preserve source/proof before deletion |
| `experiment/phase10-knockout-baseline` | Knockout + replay baseline | Preserve reproducible tests before deletion |
| `experiment/phase10-pokemon-sprites` | Native Pokémon sprite research | Preserve essential test/assets before deletion |
| `experiment/phase10-watch-handoff-browser` | Watch → Sim browser regression | Preserve essential test harness/report before deletion |

Research branches are **not** product branches. Do not merge all experimental history into the default branch merely to delete refs. Consolidate only the useful test code into a reviewed change first.

GitHub's currently connected actions can create/update branches but cannot delete branch references or change the Pages publishing setting. Deletion must use GitHub Branches UI or an authenticated GitHub CLI. Pruning content on `gh-pages` does not necessarily disable Pages hosting itself.

The private draft viewer's `watch/soccerjs/index.html` is the **iframe runtime** and must not be deleted as a supposed unused page.
