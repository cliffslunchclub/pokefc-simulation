#!/usr/bin/env bash
# The deployed site has a home/builder landing page and THREE game modes:
#   /           Home / National Free XI Builder (all 1025 Pokémon)
#   /play/      Exhibition: generated 32 gyms + Elite Four / Champions
#   /challenge/ Classic/National six-boss gauntlet
#   /franchise/ 32-gym management mode
# The older 16-gym build, Arcade, calibration and private tools are not public.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist/ratings dist/challenge dist/play dist/franchise dist/assets/js dist/assets/css dist/assets/icons

# Apache cache policy scoped to this dedicated subdomain (not other sites).
cp .htaccess dist/.htaccess

# Shared static assets, published once and referenced by every game mode.
cp index.html dist/
cp assets/icons/favicon.svg dist/assets/icons/
for file in builder.css site.css newtro.css career.css; do
  cp "assets/css/$file" "dist/assets/css/$file"
done
for file in builder.js national-species.js quick-sim.js pse-knockout.js \
            position-effectiveness.js calibration-profile.js species.js \
            career.js tactical-viewer.js soccerjs-franchise-viewer.js; do
  cp "assets/js/$file" "dist/assets/js/$file"
done
# Competitive v2 position + finishing model is required by every interactive match mode.
test -s dist/assets/js/position-effectiveness.js

# Ratings explainer is linked from the Free Builder, not a fourth game mode.
cp ratings/index.html dist/ratings/

# Challenge uses National species, special-item data, and Play opponent table.
cp challenge/index.html challenge/challenge.css challenge/special-items-data.js \
   challenge/leaderboard.js challenge/run-card.js challenge/slot-reels.js challenge/picker-window.js challenge/tiers.js challenge/match-report.js challenge/drag-drop.js challenge/performance.js challenge/item-optimizer.js dist/challenge/

# Exhibition: PSE computes the result; Soccer-JS renders the Watch.
cp play/index.html play/play.css play/play.js play/opponents.js dist/play/

# Current 32-gym Franchise stays pinned to Gen I–IV and loads the shared assets.
cp franchise/index.html dist/franchise/

# The shared authoritative Watch bridge is used by all game modes. The native
# Soccer-JS assets are included when explicitly requested by the build.
mkdir -p dist/watch/soccerjs
cp watch/soccerjs/watch-bridge.js dist/watch/soccerjs/

# Build native Soccer-JS assets before production packaging and pass
# PFC_INCLUDE_SOCCERJS=1. Developer-only partial builds may omit the bundle.
if [[ "${PFC_INCLUDE_SOCCERJS:-0}" == "1" ]]; then
  for file in index.html viewer.css viewer.bundle.js SOCCER-JS-LICENSE.txt; do
    test -s "watch/soccerjs/dist/$file" || { echo "Missing compiled Soccer-JS asset: $file" >&2; exit 1; }
  done
  test -d watch/soccerjs/dist/assets || { echo "Missing native Soccer-JS assets" >&2; exit 1; }
  test -d watch/soccerjs/dist/presets || { echo "Missing native Soccer-JS presets" >&2; exit 1; }
  mkdir -p dist/watch/soccerjs/dist
  # Explicit iframe-runtime allowlist: never publish standalone fixture.json,
  # experimental docs/tests, private result data, or upstream source.
  cp watch/soccerjs/dist/index.html watch/soccerjs/dist/viewer.css \
     watch/soccerjs/dist/viewer.bundle.js watch/soccerjs/dist/SOCCER-JS-LICENSE.txt \
     dist/watch/soccerjs/dist/
  cp -R watch/soccerjs/dist/assets watch/soccerjs/dist/presets dist/watch/soccerjs/dist/
  test ! -e dist/watch/soccerjs/dist/fixture.json
  test -s dist/watch/soccerjs/dist/viewer.bundle.js
  test -s dist/watch/soccerjs/dist/assets/pfc-soccer-ball.svg
  echo "Included native Soccer-JS 2.5D assets for the production Watch."
elif [[ "${PFC_INCLUDE_SOCCERJS:-0}" != "0" ]]; then
  echo "PFC_INCLUDE_SOCCERJS must be 0 or 1" >&2
  exit 1
fi

# Validate every local CSS/script ref, worker dependency and deployment scope.
python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote
class Resources(HTMLParser):
    def __init__(self):
        super().__init__();self.refs=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag=="script" and d.get("src"):self.refs.append(d["src"])
        if tag=="link" and d.get("href") and d.get("rel") in ("stylesheet","manifest","icon"):self.refs.append(d["href"])
root=Path("dist").resolve()
pages=[root/"index.html",root/"ratings/index.html",root/"play/index.html",root/"challenge/index.html",root/"franchise/index.html"]
for page in pages:
    if not page.is_file():raise SystemExit(f"Missing page: {page}")
    parser=Resources();parser.feed(page.read_text())
    for ref in parser.refs:
        url=urlsplit(ref)
        if url.scheme or url.netloc or url.path.startswith("/"):continue
        f=(page.parent/unquote(url.path)).resolve()
        if not f.is_relative_to(root) or not f.is_file():
            raise SystemExit(f"Missing or unsafe local resource: {page}: {ref}")
    h=page.read_text()
    if h.count('class="pfc-nav"')!=1:raise SystemExit(f"Invalid global nav count: {page}")
    for word in ["QUICK PLAY","CHALLENGES","FRANCHISE"]:
        if word not in h:raise SystemExit(f"Missing global nav entry {word}: {page}")
    expected='../' if page.parent!=root else './'
    if f'href="{expected}assets/icons/favicon.svg?v=2"' not in h:
        raise SystemExit(f"Missing shared favicon link: {page}")
    if f'src="{expected}assets/icons/favicon.svg?v=2"' not in h:
        raise SystemExit(f"Missing shared Poké Ball brand icon: {page}")
    if f'href="{expected}assets/css/newtro.css?v=1"' not in h:
        raise SystemExit(f"Missing final newtro theme: {page}")
    for mode in ["play","challenge","franchise"]:
        if f'href="{expected}{mode}/"' not in h:raise SystemExit(f"Missing game mode link: {page}: {mode}")
policy=(root/".htaccess")
if not policy.is_file():raise SystemExit("Missing PokéFC cache policy: .htaccess")
rules=policy.read_text()
if "private, no-cache, max-age=0, must-revalidate" not in rules or "FilesMatch" not in rules:
    raise SystemExit("PokéFC cache policy missing revalidation directives")
for f in ["assets/js/position-effectiveness.js","watch/soccerjs/watch-bridge.js","assets/icons/favicon.svg","assets/css/newtro.css","ratings/index.html","assets/js/national-species.js","challenge/drag-drop.js","challenge/performance.js","challenge/item-optimizer.js","challenge/leaderboard.js","challenge/run-card.js","challenge/slot-reels.js","challenge/picker-window.js","challenge/tiers.js","challenge/match-report.js","challenge/special-items-data.js","play/opponents.js","play/play.js","assets/js/builder.js","assets/css/site.css","assets/js/quick-sim.js","assets/js/pse-knockout.js","assets/js/career.js","assets/css/career.css","assets/js/species.js","assets/js/tactical-viewer.js","assets/js/soccerjs-franchise-viewer.js"]:
    if not (root/f).is_file():raise SystemExit("Missing public resource: "+f)
for forbidden in ["legacy-v07c","legacy-v05","tests",".github","calibration","MVP.md","career.js","tm-worker.js","tm-engine-bridge.js","hybrid-sim.js","tacticmesh/vendor","play/tm-worker.js","play/tm-engine-bridge.js","play/hybrid-sim.js","play/tacticmesh","franchise/tm-worker.js","franchise/tm-engine-bridge.js","franchise/hybrid-sim.js","franchise/tacticmesh","assets/js/calibration-fit.js","assets/data"]:
    if (root/forbidden).exists():raise SystemExit("Private/legacy content in public root: "+forbidden)
assert '1,025' in (root/"index.html").read_text()
assert 'XI GRADE' in (root/"index.html").read_text()
assert 'How are the grades calculated by position?' in (root/"index.html").read_text()
assert 'NATIONAL' in (root/"challenge/index.html").read_text()
assert 'class="challenge-hero"' in (root/"challenge/index.html").read_text()
assert 'id="challengeTabRankings"' in (root/"challenge/index.html").read_text()
assert 'id="challengeSlotMachine"' in (root/"challenge/index.html").read_text()
assert (root/"challenge/slot-reels.js").is_file()
assert (root/"challenge/drag-drop.js").is_file()
assert (root/"challenge/performance.js").is_file()
assert (root/"challenge/item-optimizer.js").is_file()
assert 'id="downloadRunCard"' in (root/"challenge/index.html").read_text()
assert (root/"challenge/challenge.css").is_file()
assert 'WATCH MATCH' in (root/"play/index.html").read_text()
for folder in (root/"assets/js",root/"assets/css",root/"assets/icons"):
    if not folder.is_dir():raise SystemExit("Missing shared asset folder: "+str(folder))
for legacy in ["builder.js","quick-sim.js","national-species.js","career.js","builder.css","site.css","newtro.css","favicon.svg","franchise/career.js","franchise/quick-sim.js","franchise/species.js","franchise/career.css"]:
    if (root/legacy).exists():raise SystemExit("Legacy flat asset leaked into build: "+legacy)
print("PASS SiteGround build: Home + three modes, shared /assets/ scripts and styles, no duplicate legacy paths")
PY
echo "Built PokéFC National Free Builder + Play + Challenges + 32-gym Franchise."
