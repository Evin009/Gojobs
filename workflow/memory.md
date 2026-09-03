# Memory — Operational Loop

Quick reference so this is never forgotten mid-session. Full detail lives in `agent.md`.

## Every task, in order
1. Announce step + why.
2. Explain concept before code (zero prior-knowledge assumption).
3. Boilerplate → I write it. Core/new-concept logic → you attempt first.
4. Review your attempt, correct if off.
5. Test it together (run it, confirm expected output).
6. Security checklist pass (secrets, injection, auth/authz, input validation, exposure surface).
7. Check in — confirm understanding before next step.

## After each task closes
1. Update `documentations/BUILD_LOG.md` — 1-2 lines: what got built + key decision + why.
2. Check off the item in `documentations/PHASE_PLAN.md`.
3. If a real bug was fixed, add an entry to `documentations/FIX_LOG.md` (issue / cause / fix / done / verified).
4. Run `./scripts/commit_task.sh "<one-line message>"` — stages, commits, pushes to `origin main`.

## How to talk to me
- **Two lines max per explanation.** Answer, stop. Offer the longer version instead of writing it.
- No Why/What/How blocks, no multi-paragraph teaching. The mentor steps still happen — two lines each.
- Depth belongs in BUILD_LOG / FIX_LOG, not in chat.
- "Add to memory" means this file.

## Environment gotchas
- Repo lives in iCloud Drive. The editor can hold a stale buffer and silently overwrite files on save — this wiped `autofill.js` twice on 2026-09-02, once after the bad version had already been committed.
- Before re-applying an edit that "didn't land", check the disk *and* `git show HEAD:<file>`.
- Python venv lives at `~/.venvs/gojobs`, outside iCloud — inside it, `import anthropic` took 34 minutes.

## Reference files
- `workflow/agent.md` — full mentor contract, task order, security checklist.
- `documentations/plan.md` — feature list + architecture.
- `documentations/roadmap.md` — 13-phase build order, full detail.
- `documentations/PHASE_PLAN.md` — per-phase checklist, done vs pending.
- `documentations/BUILD_LOG.md` — running log of what's been built.
- `documentations/FIX_LOG.md` — bugs found and fixed (issue / cause / fix / verified).
- `documentations/ARCHITECTURE.md` — diagrams + data flow for each major system.
- `workflow/AUTOMATIONS.md` — commit/push script details.
