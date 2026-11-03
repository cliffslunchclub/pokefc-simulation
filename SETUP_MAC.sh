#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-cliffslunchclub/pokefc-simulation}"
cd "$(dirname "$0")"

if ! command -v gh >/dev/null 2>&1; then
  echo 'GitHub CLI is required. On a Mac with Homebrew: brew install gh'
  echo 'Then run: gh auth login'
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo 'Please connect GitHub once: gh auth login'
  exit 1
fi
if [[ ! -d .git ]]; then git init -b main; fi
if ! git config user.name >/dev/null 2>&1; then
  echo 'Configure a Git author name first: git config --global user.name "Your Name"'
  exit 1
fi
if ! git config user.email >/dev/null 2>&1; then
  echo 'Configure a Git author email first: git config --global user.email "you@example.com"'
  exit 1
fi
if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Repository $REPO exists. Will only push after confirming its origin."
else
  echo "Creating new private GitHub repository: $REPO"
  gh repo create "$REPO" --private --description 'PokéFC isolated simulation benchmark and calibration runner' --disable-issues
fi
if git remote get-url origin >/dev/null 2>&1; then
  CURRENT="$(git remote get-url origin)"
  case "$CURRENT" in
    "https://github.com/$REPO"|"https://github.com/$REPO.git"|"git@github.com:$REPO.git") ;;
    *) echo "Existing origin points elsewhere: $CURRENT"; exit 1 ;;
  esac
else
  git remote add origin "https://github.com/$REPO.git"
fi
git add .
if ! git diff --cached --quiet; then git commit -m 'Add isolated TacticMesh reference calibration workflow'; fi
git branch -M main
git push -u origin main

echo
if gh workflow run pokefc-calibration.yml --repo "$REPO" --ref main -f mode=aggressive; then
  echo 'Aggressive GitHub Actions workflow dispatched. Your computer may be shut down.'
else
  echo 'Code pushed, but workflow dispatch failed (possibly GitHub Actions permissions/settings).'
  echo "Open https://github.com/$REPO/actions and click Run workflow → aggressive."
fi
echo "Results: https://github.com/$REPO/actions"
