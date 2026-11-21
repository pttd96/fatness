---
name: git-sync
description: >-
  Use this skill whenever asked to commit and push changes, sync the repository with the remote, or create a git commit. Automates pre-commit validation, staging, committing, and non-interactive pushing without getting stuck on prompts or timeouts.
---

# Git Sync Skill

This skill streamlines committing and pushing repository changes in a single automated step. It eliminates multiple round-trips of inspecting diffs and prevents `SIGKILL` timeouts caused by non-interactive credential prompts.

## Quick Execution

When the user asks to commit, push, or sync changes, execute the sync script directly:

```bash
.agents/skills/git-sync/scripts/sync.sh "<commit message>"
```

### Example
```bash
.agents/skills/git-sync/scripts/sync.sh "feat: add coach plan assignment and client replacement notifications"
```

## What the Script Automates

1. **Safety & Timeout Prevention**: Sets `GIT_TERMINAL_PROMPT=0` to ensure git never hangs waiting for an interactive terminal prompt.
2. **Pre-Commit Validation**:
   - Runs `cd frontend && npm run build` (if npm is installed).
   - Runs `cd backend && cargo check` (if cargo is installed).
   - If either check fails, the script halts before committing broken code.
3. **Smart Staging**: Checks `git status --porcelain`. If no changes exist, it exits immediately. Otherwise, stages changes (`git add -A`).
4. **Commit & Push**: Commits with the provided message and pushes to the current branch on `origin`.

## Network & Sandbox Note
* `git push` requires outbound network communication with GitHub.
* If running inside a restricted sandbox without network access, run the command with `BypassSandbox: true` if prompted so git can reach the remote repository.
