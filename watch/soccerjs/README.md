# Soccer-JS 2.5D Watch integration

Current PokéFC Watch uses the Soccer-JS renderer in Quick Play, Challenges and Franchise. PSE remains authoritative for official scores, shots, saves and match outcomes; Soccer-JS illustrates those results and does not create new official match results.

## Source and licensing

Pinned upstream: `haeretici/soccer-js@38970e0dade0865078c9e84bc1ecfd72aaa02fde` (MIT). Native builds retain its license file. Pokémon artwork remains subject to separate rightsholder permissions; runtime sprites are fetched from PokeAPI.

## Development and testing

Run Node regression suites via the public GitHub Actions **PokéFC public CI** workflow.

Build the native renderer locally:

```sh
bash watch/soccerjs/build-local.sh
PFC_INCLUDE_SOCCERJS=1 bash scripts/build-siteground.sh
python3 -m http.server 8765 --directory dist
```

For automated Chromium testing use the manually triggered **Watch browser QA** workflow. Its packaging step never uploads or deploys files. Production deployments remain the exclusive responsibility of the separate private repository.
