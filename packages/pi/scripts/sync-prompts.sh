#!/usr/bin/env bash
# sync-prompts.sh — Check and optionally sync Pi prompt files with their
# opencode agent sources. Each Pi prompt carries a <!-- Source: ... -->
# comment that identifies the source file in packages/opencode/agents/.
#
# Usage:
#   bash scripts/sync-prompts.sh          # check only
#   bash scripts/sync-prompts.sh --update # copy drifted sources
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PI_DIR/../.." && pwd)"

PROMPTS_DIR="$PI_DIR/prompts"
UPDATE=false

if [[ "${1:-}" == "--update" ]]; then
  UPDATE=true
fi

# Strip YAML frontmatter (everything between the first --- and the second ---)
strip_frontmatter() {
  perl -0777 -pe 's/^---\n.*?\n---\n//s' "$1"
}

# Normalize role prefixes for comparison: / → @ (Pi conventions back to opencode source conventions)
# The Pi prompts use /adventurer, /builder, etc. while opencode sources use @adventurer, @builder.
# We match /role only when preceded by a non-letter/non-slash character (space, backtick, etc.)
# to avoid matching inside URL paths like review/reviewer. Start-of-line case is also handled.
normalize_role_prefixes() {
  local text="$1"
  echo "$text" | sed \
    -e 's|\([^a-zA-Z/]\)/adventurer|\1@adventurer|g' \
    -e 's|^/adventurer|@adventurer|g' \
    -e 's|\([^a-zA-Z/]\)/architect|\1@architect|g' \
    -e 's|^/architect|@architect|g' \
    -e 's|\([^a-zA-Z/]\)/builder|\1@builder|g' \
    -e 's|^/builder|@builder|g' \
    -e 's|\([^a-zA-Z/]\)/diagnose|\1@diagnose|g' \
    -e 's|^/diagnose|@diagnose|g' \
    -e 's|\([^a-zA-Z/]\)/planner|\1@planner|g' \
    -e 's|^/planner|@planner|g' \
    -e 's|\([^a-zA-Z/]\)/reviewer|\1@reviewer|g' \
    -e 's|^/reviewer|@reviewer|g' \
    -e 's|\([^a-zA-Z/]\)/writer|\1@writer|g' \
    -e 's|^/writer|@writer|g'
}

ALL_SYNCED=true
UPDATED=0

for prompt_file in "$PROMPTS_DIR"/*.md; do
  name="$(basename "$prompt_file")"
  first_line=$(head -1 "$prompt_file")

  # Parse the <!-- Source: ... --> comment (handles em dash between filename and "keep in sync")
  if [[ "$first_line" =~ \<\!\-\-\ Source:\ (packages/opencode/agents/[^ ]+\.md)\ .*--\> ]]; then
    source_rel="${BASH_REMATCH[1]}"
  else
    echo "⚠   $name — no valid Source comment, skipping"
    continue
  fi

  source_abs="$REPO_ROOT/$source_rel"

  if [ ! -f "$source_abs" ]; then
    echo "⚠   $name — source file missing ($source_rel)"
    ALL_SYNCED=false
    continue
  fi

  # Normalize both sides for comparison:
  #   Prompt: strip the <!-- Source: ... --> line, then replace
  #           maestria_subagent( with task( (the delegation rename),
  #           and normalize /→@ role prefixes
  #   Source: strip YAML frontmatter
  prompt_body=$(tail -n +2 "$prompt_file" | sed 's/maestria_subagent(/task(/g')
  prompt_body=$(normalize_role_prefixes "$prompt_body")
  source_body=$(strip_frontmatter "$source_abs")

  # Strip leading blank lines from both sides to avoid false DRIFTED
  # from differing blank-line patterns between the prompt source-comment
  # and the source frontmatter.
  prompt_body=$(echo "$prompt_body" | sed '/./,$!d')
  source_body=$(echo "$source_body" | sed '/./,$!d')

  if diff <(echo "$prompt_body") <(echo "$source_body") > /dev/null 2>&1; then
    echo "✓   $name — in sync"
  else
    echo "✗   $name — DRIFTED"
    ALL_SYNCED=false

    if $UPDATE; then
      # Write updated content: source comment + source body with task() → maestria_subagent()
      {
        echo "<!-- Source: $source_rel — keep in sync when updating -->"
        strip_frontmatter "$source_abs" | sed 's/task(/maestria_subagent(/g' | sed \
          -e 's|@adventurer|/adventurer|g' \
          -e 's|@architect|/architect|g' \
          -e 's|@builder|/builder|g' \
          -e 's|@diagnose|/diagnose|g' \
          -e 's|@planner|/planner|g' \
          -e 's|@reviewer|/reviewer|g' \
          -e 's|@writer|/writer|g'
      } > "$prompt_file"
      echo "    → Updated $name"
      UPDATED=$((UPDATED + 1))
    fi
  fi
done

echo ""
if $UPDATE; then
  echo "Done. $UPDATED prompt(s) updated."
else
  echo "Run with --update to bring drifted prompts back in sync."
fi

if ! $ALL_SYNCED; then
  exit 1
fi
