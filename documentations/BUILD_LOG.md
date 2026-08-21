# Build Log

Feature-by-feature record: what got built, key decisions, why. Updated after each task closes. Kept brief — for review + interview prep, not a diary.

Format per entry (1-2 lines max, no more):
```
### [date] — [task name]
- [one line: what got built + key decision + why, combined]
```

---

## Phase 0 — Planning (pre-build)

### 2026-08-15 — Scoped MVP, wrote roadmap.md
- Built: plan.md (8 features), roadmap.md (13 phases), agent.md mentor contract.
- Decision: monitor Greenhouse/GitHub via APIs + Slack alert instead of on-page scraping (avoids ToS risk, more reliable).
- Decision: resume tailoring stays LaTeX in/out, AI edits bullets only — preserves formatting.
- Decision: build Go+Postgres fundamentals first, then plain Claude calls, then RAG/extension/AI-judgment last.

---

### 2026-08-15 — Verified environment
- Go 1.26.5, Postgres 17.6 (running), Python 3.13.3 all confirmed installed/working.

### 2026-08-15 — Go module + /health, /ping routes
- Built: `backend/go.mod`, `backend/main.go` with stdlib `net/http` server, `/health` → "ok", `/ping` → "pong".
- Decision: raw `net/http` over gin/chi for now — learn routing/handlers manually before reaching for a framework.

### 2026-08-20 — Switched Postgres to Supabase
- Decision: use Supabase (managed Postgres + Auth + RLS) instead of local Postgres — avoids local install/multi-version conflicts hit during setup, adds free Auth for later phases.
- Built: `.gitignore`, `backend/.env` (real secrets, gitignored) + `.env.example`; plan.md/roadmap.md updated to reference Supabase throughout.

### 2026-08-20 — Go connects to Supabase Postgres
- Built: `backend/db.go` (`connectDB()` — pgx pool + Ping), wired into `main.go`; used Session Pooler connection string (direct connection needs IPv6, unavailable on this network).
- Decision: `connectDB()` crashes via `log.Fatalf` on connection failure instead of returning an error — app is useless without DB, fail fast at startup.

### 2026-08-20 — Created `jobs` table
- Built: `backend/table.sql` — `jobs` table (id/company/role/description/url/source/created_at), unique constraint on `url` for dedupe, RLS enabled with zero policies.
- Decision: unique `url` constraint doubles as dedupe logic — insert and let Postgres reject repeats instead of manual diff checks.

### 2026-08-20 — Organized SQL into migrations folder
- Built: moved `table.sql` → `backend/migrations/001_create_jobs.sql`, added trailing semicolon.

### 2026-08-21 — InsertJob writes to Supabase
- Built: `backend/jobs.go` (`InsertJob`) — parameterized INSERT with `ON CONFLICT (url) DO NOTHING` dedupe; verified a real row lands in Supabase via direct SQL check.
- Decision: package-level `dbPool` var in `db.go`, set once in `main()` — simplest sharing approach for current project size.

### 2026-08-21 — Docs reorganized, phase checklist added
- Built: `documentations/` (plan/roadmap/build log) and `workflow/` (agent.md/memory.md/automations) folders; `documentations/PHASE_PLAN.md` — per-phase checkbox list.
- Decision: `agent.md`/`memory.md` updated to point at new paths and to check off `PHASE_PLAN.md` after each task.

## Phase 1 — Go backend skeleton: complete
