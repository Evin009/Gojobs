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
3. Run `./scripts/commit_task.sh "<one-line message>"` — stages, commits, pushes to `origin main`.

## Reference files
- `workflow/agent.md` — full mentor contract, task order, security checklist.
- `documentations/plan.md` — feature list + architecture.
- `documentations/roadmap.md` — 13-phase build order, full detail.
- `documentations/PHASE_PLAN.md` — per-phase checklist, done vs pending.
- `documentations/BUILD_LOG.md` — running log of what's been built.
- `workflow/AUTOMATIONS.md` — commit/push script details.
