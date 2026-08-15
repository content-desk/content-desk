#!/usr/bin/env bash
set -euo pipefail

# ContentDesk currently has no worktree-owned services or databases. Shared
# services must not be stopped when a secondary worktree is removed.

CURRENT_WORKTREE=$(git rev-parse --show-toplevel)

echo "Cleaning worktree: $CURRENT_WORKTREE"
echo "No worktree-owned resources to clean up."
