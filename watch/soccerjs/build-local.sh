#!/usr/bin/env bash
# LOCAL BUILD ONLY. Never triggers private GitHub Actions, SiteGround, or Pages.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Building isolated PokéFC Phase 10 Soccer-JS replay; no production files touched."
git clone --filter=blob:none --no-checkout https://github.com/haeretici/soccer-js.git "$TMP/upstream"
git -C "$TMP/upstream" checkout --detach 38970e0dade0865078c9e84bc1ecfd72aaa02fde
(cd "$TMP/upstream" && npm install --no-audit --no-fund)
cp "$HERE/viewer-entry.cjs" "$TMP/upstream/phase10-viewer-entry.cjs"
cp "$HERE/phase10-motion.cjs" "$TMP/upstream/phase10-motion.cjs"
cp "$HERE/phase10-play-director.cjs" "$TMP/upstream/phase10-play-director.cjs"
cp "$HERE/phase10-player-pace.cjs" "$TMP/upstream/phase10-player-pace.cjs"
cp "$HERE/phase10-goalkeeper-rush.cjs" "$TMP/upstream/phase10-goalkeeper-rush.cjs"
cp "$HERE/phase10-camera-zoom.cjs" "$TMP/upstream/phase10-camera-zoom.cjs"
cp "$HERE/phase10-team-shape.cjs" "$TMP/upstream/phase10-team-shape.cjs"
cp "$HERE/phase10-wall-physics.cjs" "$TMP/upstream/phase10-wall-physics.cjs"
cp "$HERE/highlight-replay.cjs" "$TMP/upstream/highlight-replay.cjs"
cp "$HERE/phase10-commentary.cjs" "$TMP/upstream/phase10-commentary.cjs"
cp "$HERE"/pokemon-*.cjs "$TMP/upstream/"
mkdir -p "$HERE/dist"
"$TMP/upstream/node_modules/.bin/esbuild" "$TMP/upstream/phase10-viewer-entry.cjs" \
  --bundle --platform=browser --format=iife --target=es2020 \
  --minify --outfile="$HERE/dist/viewer.bundle.js"
cp "$HERE/index.html" "$HERE/viewer.css" "$HERE/fixture.json" "$HERE/dist/"
cp -R "$TMP/upstream/assets" "$TMP/upstream/presets" "$HERE/dist/"
cp "$HERE/soccer-ball.svg" "$HERE/dist/assets/pfc-soccer-ball.svg"
cp "$TMP/upstream/LICENSE" "$HERE/dist/SOCCER-JS-LICENSE.txt"
test -s "$HERE/dist/viewer.bundle.js"
test -s "$HERE/dist/assets/animation_rigs/1.json"
test -s "$HERE/dist/assets/pfc-soccer-ball.svg"
echo "Built local viewer at $HERE/dist/"
echo "To test: python3 -m http.server 8765 --directory \"$HERE/dist\""
echo "Then visit http://localhost:8765/"
