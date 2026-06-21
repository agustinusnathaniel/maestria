#!/usr/bin/env bash
# Verify that compiled dist/ has .js extensions on all relative imports
# This prevents the "bundler" moduleResolution bug from recurring
set -euo pipefail

cd "$(dirname "$0")/.."

# Find all .js files in dist/ that have extensionless relative imports
MISSING=$(grep -rn 'from "\./\|from "\.\./' dist/ | grep -v '\.js"' | grep -v '\.mjs"' || true)

if [ -n "$MISSING" ]; then
  echo "ERROR: Found extensionless relative imports in dist/."
  echo "TypeScript with moduleResolution:node16 should prevent this, but check your tsconfig."
  echo "$MISSING"
  exit 1
fi

echo "OK: All relative imports in dist/ have .js extensions."
