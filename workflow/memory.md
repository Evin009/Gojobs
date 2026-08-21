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
1. Update `BUILD_LOG.md` — 1-2 lines: what got built + key decision + why.
2. Run `./scripts/commit_task.sh "<one-line message>"` — stages, commits, pushes to `origin main`.

## Reference files
- `agent.md` — full mentor contract, task order, security checklist.
- `plan.md` — feature list + architecture.
- `roadmap.md` — 13-phase build order.
- `BUILD_LOG.md` — running log of what's been built.
- `AUTOMATIONS.md` — commit/push script details.
