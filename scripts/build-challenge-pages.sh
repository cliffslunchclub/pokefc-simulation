#!/usr/bin/env bash
# The Challenge page shares PSE, sprites, styling and the Soccer-JS bridge with
# the other modes. Use the canonical SiteGround packaging to avoid broken
# stand-alone bundles with missing resources.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/build-siteground.sh
echo "Challenge-ready build is in dist/challenge/ (shared libraries in dist/assets/)."
