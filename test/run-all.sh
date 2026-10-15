#!/usr/bin/env bash
# Full Maestro test suite. Usage: bash test/run-all.sh   (jsdom installs to a temp dir on first run)
set -u
cd "$(dirname "$0")/.."
node build-standalone.js || exit 1
node --check data.js && node --check engine.js && node --check ai.js && node --check app.js || exit 1
echo "== engine smoke ==" && node test/smoke.js || exit 1
DEPS=$(mktemp -d)
(cd "$DEPS" && npm install jsdom --no-audit --no-fund --loglevel=error >/dev/null 2>&1) || { echo "jsdom install failed - skipping DOM suites"; exit 0; }
for suite in dom full crisis standalone; do
  echo "== $suite =="
  MAESTRO_DIR="$(pwd)" NODE_PATH="$DEPS/node_modules" node "test/$suite.js" || exit 1
done
echo "ALL SUITES PASS"
