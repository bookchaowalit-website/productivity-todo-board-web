#!/usr/bin/env bash
# Post-deploy smoke check of the production site (read-only GETs).
# Usage: scripts/deploy-smoke.sh <base-url> [expected-commit]
# 1. The home page answers 200 and shows HOME_MARKER.
# 2. The build marker (HEALTH_PATH) reports the expected commit. Retried while Vercel moves the
#    production alias; without an expected commit it only has to report one.
# 3. The retired REDIRECT_ROUTE answers 308 with Location REDIRECT_TARGET (not followed).
set -euo pipefail

HOME_MARKER="Todo Board"
HEALTH_PATH="/api/health"
REDIRECT_ROUTE="/more-projects"
REDIRECT_TARGET="https://bookchaowalit.com/"

BASE="${1:?usage: deploy-smoke.sh <base-url> [expected-commit]}"
BASE="${BASE%/}"
EXPECTED="${2:-}"
EXPECTED="${EXPECTED:0:7}"
ATTEMPTS="${SMOKE_ATTEMPTS:-20}"
DELAY="${SMOKE_DELAY:-15}"
fail=0
body=$(mktemp)
trap 'rm -f "$body"' EXIT

get() {
  curl -sS -L --max-time 30 -o "$body" -w '%{http_code}' -H 'cache-control: no-cache' "$BASE$1" || echo "000"
}

redirect() {
  local path="$1" target="$2" out code location
  out=$(curl -sS --max-time 30 -o /dev/null -w '%{http_code} %{redirect_url}' -H 'cache-control: no-cache' "$BASE$path" || echo "000 ")
  code="${out%% *}"
  location="${out#* }"
  if [ "$code" = 308 ] && [ "$location" = "$target" ]; then
    echo "ok   308 $path -> $target"
  else
    echo "::error::FAIL $path answered $code with Location '${location}', expected 308 to $target"
    fail=1
  fi
}

page() {
  local path="$1" marker="$2" code
  code=$(get "$path")
  if [ "$code" != 200 ]; then
    echo "::error::FAIL $code $path"
    fail=1
  elif ! grep -qF -- "$marker" "$body"; then
    echo "::error::FAIL $path answered 200 but does not show \"$marker\""
    fail=1
  else
    echo "ok   200 $path shows \"$marker\""
  fi
}

page / "$HOME_MARKER"

commit=""
for attempt in $(seq 1 "$ATTEMPTS"); do
  code=$(get "$HEALTH_PATH?smoke=$(date +%s)")
  commit=$(grep -oE '"commit": *"[0-9a-f]{7,40}"' "$body" | grep -oE '[0-9a-f]{7,40}' || true)
  commit="${commit:0:7}"
  if [ "$code" = 200 ] && [ -n "$commit" ] && { [ -z "$EXPECTED" ] || [ "$commit" = "$EXPECTED" ]; }; then
    break
  fi
  echo "wait $HEALTH_PATH answered $code, commit '${commit:-none}', expected '${EXPECTED:-any}' (attempt $attempt/$ATTEMPTS)"
  [ "$attempt" -lt "$ATTEMPTS" ] && sleep "$DELAY"
done
if [ "$code" = 200 ] && [ -n "$commit" ] && { [ -z "$EXPECTED" ] || [ "$commit" = "$EXPECTED" ]; }; then
  echo "ok   200 $HEALTH_PATH reports commit $commit"
else
  echo "::error::FAIL production does not run the expected commit: $HEALTH_PATH answered $code with commit '${commit:-none}', expected '${EXPECTED:-any}'"
  fail=1
fi

redirect "$REDIRECT_ROUTE" "$REDIRECT_TARGET"

exit "$fail"
