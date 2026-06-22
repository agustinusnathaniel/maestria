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
  #           maestria_subagent( with task( (the delegation rename)
  #   Source: strip YAML frontmatter
  prompt_body=$(tail -n +2 "$prompt_file" | sed 's/maestria_subagent(/task(/g')
  source_body=$(strip_frontmatter "$source_abs")

  if diff <(echo "$prompt_body") <(echo "$source_body") > /dev/null 2>&1; then
    echo "✓   $name — in sync"
  else
    echo "✗   $name — DRIFTED"
    ALL_SYNCED=false

    if $UPDATE; then
      # Write updated content: source comment + source body with task() → maestria_subagent()
      {
        echo "<!-- Source: $source_rel — keep in sync when updating -->"
        echo ""
        strip_frontmatter "$source_abs" | sed 's/task(/maestria_subagent(/g'
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
