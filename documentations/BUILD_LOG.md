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

### 2026-08-22 — Greenhouse fetch working
- Built: `backend/greenhouse.go` — `FetchGreenhouseJobs(company)`, structs matching Greenhouse's JSON shape; verified live against Stripe's real board (576 jobs parsed).
- Decision: list endpoint has no full job description — storing empty placeholder for now, deferred to a later per-job detail fetch.

### 2026-08-22 — Keyword filter for Greenhouse jobs
- Built: `filterJobsKeyword(jobs, keyword)` — case-insensitive title match via `strings.Contains`/`ToLower`; verified live (129/575 Stripe jobs matched "engineer"). Phase 2 complete.

### 2026-08-22 — Save + dedupe verified end to end
- Built: `SaveGreenhouseJobs(jobs)` — loops matched jobs, calls `InsertJob`, logs failures without stopping the batch.
- Verified live: first run inserted 129 rows, second identical run left row count unchanged — `ON CONFLICT (url) DO NOTHING` dedupe confirmed working. Phase 3 complete.

### 2026-08-22 — Slack notify wired end to end
- Built: `backend/slack.go` (`SendSlackMessage`) — JSON-encodes and POSTs to a Slack Incoming Webhook; `InsertJob` now returns `(inserted bool, error)` via `RowsAffected()` so `SaveGreenhouseJobs` only notifies on genuinely new jobs, not duplicates.
- Verified live against Airbnb's board — 2 new "intern" matches triggered 2 real Slack messages. Phase 4 complete.

### 2026-08-22 — Batched Slack notify + keyword filter fix
- Built: `SaveGreenhouseJobs` now returns newly-inserted jobs instead of notifying per-job; `NotifyNewJobs` sends one summary message (count + timestamp + numbered list) instead of spamming one message per job.
- Bug found + fixed: `filterJobsKeyword` used substring matching, so keyword "intern" matched "Internal Audit" jobs. Switched to `regexp` with `\b` word boundaries — verified live against Coinbase (correctly went from 6 false matches to 0 real ones).

### 2026-08-22 — Concurrent multi-company monitor + scheduling
- Built: `backend/monitor.go` — `MonitorGreenhouseCompanies` (goroutines + channel + WaitGroup, checks all companies in parallel, one combined Slack summary), `StartMonitorLoop` (`time.Ticker`, repeats forever). Wired into `main.go` at a real 30-minute interval.
- Verified live: Figma + Brex fetched/saved concurrently (70 rows), Slack summary received. Phase 5 complete.
- Noted for later: `FetchGreenhouseJobs` has no request timeout — a hung request could cause overlapping runs since later ticks launch via `go`. Flagged, not yet fixed. Company list/keyword still hardcoded — becomes a real setting once user-config exists.

### 2026-08-23 — Multi-keyword filter + location in Slack messages
- Built: `filterJobsKeywords` now takes `[]string` (matches ANY keyword, whole-word); `MonitorGreenhouseCompanies`/`StartMonitorLoop` updated to match; Slack summary now shows `(location)` next to each job.
- Verified live against Databricks + Robinhood with `["intern","internship"]` — 4 real matches, zero false positives (previous "engineer" test had masked the wrong-keyword issue, not a filter bug).

### 2026-08-23 — Refactored to shared JobPosting type; scoped GitHub monitor design
- Built: `backend/jobposting.go` — `JobPosting` struct (company/title/url/location/source) + `NotifyNewJobs` now generic across sources; `SaveGreenhouseJobs` converts to it. Regression-tested against Block, still correct.
- Decision: GitHub repo list will be dynamic (new `monitored_repos` Supabase table), not hardcoded — sets up for the extension's future "monitor this repo?" popup (Phase 11) to add repos via the backend. Docs (plan/roadmap/phase plan) updated to record this before building it.

### 2026-08-23 — monitored_repos table + Go read/write
- Built: `monitored_repos` table (url unique, RLS enabled); `AddMonitoredRepo`/`GetMonitoredRepos` in `backend/monitored_repo.go` — first use of `pool.Query`/`rows.Scan` for reading multiple rows back (vs `Exec` for writes). Verified live end to end.

### 2026-08-23 — GitHub listings fetch/filter/save built
- Built: `backend/github.go` — `FetchGitHubListings`/`filterGitHubListings`/`SaveGitHubListings`, same pattern as Greenhouse but decoding a plain-array JSON root (no wrapper object).
- Verified live against SimplifyJobs/Summer2026-Internships (14,532 listings) — correct matches, correct dedupe, zero crashes on empty location arrays.

### 2026-08-23 — Reorganized backend into internal/ packages
- Built: split flat `package main` files into `internal/{db,slack,jobposting,greenhouse,github,monitor}` — each a real Go package now, `main.go` only wires things together. `internal/` is a Go convention restricting imports to code within this module.
- Verified: full rebuild + live server test (routes, DB connect) confirm nothing broke functionally.

### 2026-08-23 — GitHub concurrent monitor, Phase 6 complete
- Built: `monitor.GitHub(keywords)` — same concurrent fetch/filter/save/notify pattern as `monitor.Greenhouse`, but reads its repo list dynamically via `db.GetMonitoredRepos()` instead of a hardcoded slice. Wired into `StartLoop` so it runs immediately alongside Greenhouse, not just on the first tick.
- Verified live: 122 real "product" matches from SimplifyJobs/Summer2026-Internships fetched/saved correctly through the full package-split pipeline.

### 2026-08-24 — Grouped, deduped Slack notifications
- Built: single combined notification per check instead of separate Greenhouse/GitHub messages. `jobposting.Posting` gained `RepoName`; `NotifyNew` now groups output into "*Source: Greenhouse*" and "*Source: GitHub*" (sub-grouped by `repo:`) sections, first-found order preserved via an ordered slice (map iteration order isn't stable in Go). `github.RepoNameFromURL` extracts a readable "owner/repo" label from the feed URL. `monitor.go`'s `Greenhouse`/`GitHub` renamed to unexported `checkGreenhouse`/`checkGitHub`, now return results instead of notifying directly — `runOnce` combines both and sends one message.
- Confirmed: cross-source duplicate URLs already can't double-notify (unique `url` constraint + `RowsAffected()` check) — no code change needed there, just clarified with the user.
- Verified live against Cloudflare (Greenhouse) + SimplifyJobs repo (GitHub) — 21 rows saved correctly across both sources, no errors.

## Phase 7 — Python AI service skeleton

### 2026-08-24 — FastAPI skeleton + /health
- Built: `ai-service/` (venv, FastAPI + uvicorn + anthropic + python-dotenv, `.env`/`.env.example`/`.gitignore`); `main.py` with `/health` route, verified live (`200 OK`).

### 2026-08-24 — POST /ask endpoint (Claude API call)
- Built: `/ask` route — Pydantic `AskRequest` body, calls `client.messages.create` (model `claude-opus-5`), extracts the text block from `response.content`.
- Status: request reaches Anthropic correctly (confirmed via a real structured `400` back) but blocked by low account credit balance — not a code issue. Full round-trip unverified until credits are added; not marking this checklist item done yet.

## Phase 8 — LaTeX resume tailoring

### 2026-08-24 — LaTeX compile step + resume versioning design
- Built: installed `tectonic` (self-contained LaTeX engine, no full TeX Live needed); `ai-service/latex.py` (`compile_latex`) — writes `.tex` to a temp dir, runs tectonic via `subprocess`, reads back PDF bytes. Verified live against `fixtures/sample_resume.tex` — valid PDF confirmed (`%PDF` header, correct size). No Claude/credits needed for this part.
- Decision: confirmed `.tex` upload is a hard requirement (no reliable PDF/DOCX → LaTeX conversion) — documented in plan.md. Also clarified: every job gets its own tailored resume saved as a new `resumes` row (never overwritten), linked to its application via `resume_id`.

### 2026-08-24 — Claude tailoring call + full pipeline wired
- Built: `ai-service/tailor.py` (`tailor_resume`) — system prompt constrains Claude to bullet-only edits, no structural changes, no invented content; `POST /tailor-resume` in `main.py` chains `tailor_resume` → `compile_latex`, returns raw PDF bytes (`Response`, not JSON).
- Status: full pipeline wired and imports cleanly; server starts and `/health` still passes. The Claude call itself remains unverified pending account credits (same blocker as `/ask`).

### 2026-08-24 — resumes table created
- Built: `backend/migrations/003_create_resume.sql` — `resumes` table (`content` text, nullable `job_id` FK to `jobs.id` since the base resume isn't tied to a job, `created_at`), RLS enabled. Verified live via `\d resumes`.

### 2026-08-25 — Python connects to Supabase, resume saving wired end to end
- Built: `ai-service/db.py` (`save_resume`, via `psycopg`) — Python's first direct Postgres connection, reuses the same `DATABASE_URL` as the Go backend. Verified live — real row landed in `resumes` (`job_id` correctly `NULL` for a base resume).
- Wired `save_resume` into `POST /tailor-resume`: tailor → save → compile, in that order. `TailorRequest` gained optional `job_id` to link a tailored version to a real job. Phase 8 fully complete except live-verifying the Claude call itself (pending account credits).

## Phase 9 — Cover letter generation

### 2026-08-25 — Cover letter endpoint
- Built: `ai-service/cover_letter.py` (`generate_cover_letter`) + `POST /cover-letter` — same Claude-call pattern as `tailor_resume`, new prompt/output (plain-text letter, not LaTeX). Server starts clean; Claude call itself pending credits, same as Phase 7/8.

## Phase 10 — Style memory (vector DB)

### 2026-08-25 — Chroma embedding + retrieval, verified live (no credits needed)
- Built: `ai-service/style_memory.py` (`add_sample`, `query_samples`) — `chromadb.PersistentClient` + collection; embedding happens automatically on `.add()` (local model, no API key). Verified live: leadership samples correctly ranked above an unrelated "chocolate cake" sample — real semantic similarity, not keyword matching.
- Decision: style-matching is optional, degrades gracefully if no samples exist (noted in plan.md). `chroma_data/` gitignored, matches `venv/` pattern.

### 2026-08-25 — Metadata filtering (sample type)
- Built: `add_sample`/`query_samples` gained `sample_type` (`"resume_bullet"`/`"cover_letter"`) + `created_at` metadata, retrieval filters by `where={"type": ...}`. Verified live: two topically-similar but different-type samples correctly stayed isolated per query — no cross-type contamination.

### 2026-08-25 — RAG wired into cover letter generation, Phase 10 complete
- Built: `generate_cover_letter` now calls `query_samples` first, prepends matched past samples as a `style_block` in the Claude prompt. Confirmed live that `query_samples` returns a clean empty list (not an error) when no samples exist — graceful degradation works with zero extra error-handling code. `documentations/ARCHITECTURE.md` added with mermaid diagrams for all 3 major flows (monitoring, resume tailoring, RAG cover letter).

## Infra

### 2026-08-25 — CI pipeline (GitHub Actions)
- Built: `.github/workflows/ci.yml` — two parallel jobs, `go build`/`go vet` for the backend, dependency install + import smoke-check for ai-service. Verified locally (both pass) before relying on CI to run them. CD (auto-deploy) intentionally deferred — no hosting chosen yet (see plan.md).
