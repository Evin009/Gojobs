#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/commit_task.sh \"one-line commit message\""
  exit 1
fi

git add -A
git commit -m "$1"
git push origin main
