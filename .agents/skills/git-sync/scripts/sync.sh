#!/usr/bin/env bash
set -e

# Non-interactive git prompt to prevent hanging / SIGKILL
export GIT_TERMINAL_PROMPT=0

COMMIT_MSG="${1:-}"
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="chore: update project changes"
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "==> [git-sync] Running pre-commit validation..."

# 1. Frontend validation (if npm is available)
if command -v npm >/dev/null 2>&1; then
  if [ -d "frontend" ]; then
    echo "--> Checking frontend build..."
    (cd frontend && npm run build) || {
      echo "❌ Frontend build failed! Aborting commit."
      exit 1
    }
  fi
else
  echo "⚠️  npm not found in PATH; skipping frontend build check."
fi

# 2. Backend validation (if cargo is available)
if command -v cargo >/dev/null 2>&1; then
  if [ -d "backend" ]; then
    echo "--> Checking backend compilation..."
    (cd backend && cargo check) || {
      echo "❌ Backend check failed! Aborting commit."
      exit 1
    }
  fi
else
  echo "⚠️  cargo not found in PATH; skipping backend check."
fi

# 3. Check git status
CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
  echo "==> [git-sync] Working directory is clean. Nothing to commit."
  exit 0
fi

echo "==> [git-sync] Staging changes..."
git add -A

echo "==> [git-sync] Committing with message: '$COMMIT_MSG'..."
git commit -m "$COMMIT_MSG"

# 4. Push to origin
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'main')"
echo "==> [git-sync] Pushing to origin/$CURRENT_BRANCH..."

if git push origin "$CURRENT_BRANCH"; then
  echo "✅ [git-sync] Successfully committed and pushed to origin/$CURRENT_BRANCH."
else
  STATUS=$?
  echo "❌ [git-sync] git push failed with exit code $STATUS."
  echo "Tip: Ensure git credentials (SSH key or GitHub CLI auth) and network access are configured."
  exit $STATUS
fi
