#!/usr/bin/env bash
set -euo pipefail

# Prepare a Codex worktree after checkout:
# 1. Copy selected local files from the primary worktree.
# 2. Install the pinned pnpm workspace dependencies once from the root.

CURRENT_WORKTREE=$(git rev-parse --show-toplevel)
COMMON_GIT_DIR=$(git rev-parse --path-format=absolute --git-common-dir)
MAIN_WORKTREE=$(dirname "$COMMON_GIT_DIR")

if ! git -C "$MAIN_WORKTREE" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Unable to resolve the primary worktree from $COMMON_GIT_DIR." >&2
  exit 1
fi

echo "Primary worktree: $MAIN_WORKTREE"
echo "Current worktree: $CURRENT_WORKTREE"

if [ "$MAIN_WORKTREE" = "$CURRENT_WORKTREE" ]; then
  echo "Already in the primary worktree; no local files to copy."
else
  worktree_files_list="$MAIN_WORKTREE/.worktree-files"
  if [ -f "$worktree_files_list" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in
        '' | \#*) continue ;;
      esac

      source_file="$MAIN_WORKTREE/$line"
      destination_file="$CURRENT_WORKTREE/$line"
      if [ -f "$source_file" ]; then
        mkdir -p "$(dirname "$destination_file")"
        cp "$source_file" "$destination_file"
        echo "Copied $line"
      else
        echo "$line not found in the primary worktree; skipping"
      fi
    done < "$worktree_files_list"
  else
    echo ".worktree-files not found in the primary worktree; skipping local files."
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but was not found in PATH." >&2
  exit 1
fi

echo "Installing workspace dependencies..."
(cd "$CURRENT_WORKTREE" && pnpm install --frozen-lockfile)

echo "Worktree initialization complete."
