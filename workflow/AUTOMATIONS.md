# Automations

## Auto commit + push per task

After each small task within a feature is done (code works, checked in per agent.md task order), stage/commit/push automatically.

**Script:** `scripts/commit_task.sh "<one-line message>"`
- Stages all changes (`git add -A`)
- Commits with the one-line message you pass in
- Pushes to `origin main`

**Usage:**
```bash
./scripts/commit_task.sh "add greenhouse job fetch endpoint"
```

**Note:** pushes straight to `main` on every small task — no review pause. Fine for solo learning project, revisit if this ever gets collaborators.
