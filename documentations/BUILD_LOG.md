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
- Confirmed live on GitHub Actions — both jobs pass; fixed a Go module cache-path warning (`cache-dependency-path: backend/go.sum`, monorepo subfolder issue).

## Phase 11 — Extension skeleton

### 2026-08-25 — POST /repos endpoint
- Built: `main.go` gained `addRepoHandler` (`POST /repos`) — decodes `{"url": "..."}"` from the request body, calls `db.AddMonitoredRepo`. First Go handler reading a request body (reused the same `json.NewDecoder` pattern from `FetchGreenhouseJobs`, applied to `r.Body` instead of `resp.Body`). Verified live via curl, row confirmed in `monitored_repos`, test row cleaned up.
- This is the endpoint the extension's future "monitor this repo?" popup will call.

### 2026-08-26 — "Monitor this repo?" panel working end to end
- Built: `extension/github_monitor.js` — detects `/owner/repo` pages, mounts a floating panel (Shadow DOM for style isolation), POSTs the guessed feed URL to `/repos`. Full state cycle: idle → loading → success (auto-dismiss) → retryable error. Dark mode + `prefers-reduced-motion` handled.
- Built: `withCORS` middleware in `main.go`. Browsers send an `OPTIONS` preflight before cross-origin POSTs; without a reply the real request is never sent — this was a live failure during testing, not a theoretical one.
- Security: `owner`/`repo` come from the URL, so they're written with `textContent` rather than interpolated into `innerHTML` — same injection principle as parameterized SQL. Also noted: `Allow-Origin: *` is fine for local dev but should be narrowed before this is ever exposed publicly.
- Verified live in Chrome: clicked the panel on `vanshb03/Summer2027-Internships`, row confirmed in `monitored_repos`, and the guessed feed URL returns `200` — so the 30-min monitor loop will get real data from it.
- Known gap: GitHub is an SPA, so the script doesn't re-run on client-side navigation between repos.

### 2026-08-26 — Don't re-prompt on already-monitored repos
- Built: `GET /repos` (reuses existing `db.GetMonitoredRepos`, no new DB code) + `reposHandler` branching on method; extension now calls `isMonitored()` before mounting and shows a passive auto-fading badge instead of the full prompt.
- Decision: method is branched inside one handler rather than registering Go 1.22+ `"GET /repos"` / `"POST /repos"` patterns — an OPTIONS preflight would match neither and 405 before `withCORS` could answer, silently re-breaking CORS.
- Decision: the check **fails open** (backend down → show the panel). Re-adding is idempotent via `ON CONFLICT DO NOTHING`, so a redundant panel is harmless, while wrongly hiding it would silently imply a repo is watched when it isn't.
- Gotcha handled: a nil Go slice encodes as JSON `null`, not `[]`, which would break `Array.isArray()` on the JS side — empty slice substituted before encoding.
- Verified live: monitored repo → `true`, unseen repo → `false`, backend down → `false` (panel shows). Bad method → 405, preflight still 200.

### 2026-08-26 — Markdown tracker support + backend feed resolution
- Built: `internal/github/markdown.go` — parses markdown job tables into the same `Listing` type as the JSON feed; `ResolveFeedURL` tries known conventions and only accepts one that fetches *and* parses. `POST /repos` now takes `{owner, repo}` and 422s when no feed exists.
- Built: **first Go tests in the project** — `markdown_test.go` (3 tests), added `go test ./...` to CI. Verified against the live file: 297 real listings parsed correctly.
- Decision: feed conventions moved from the extension to the backend — a client shouldn't need to know where a tracker publishes its jobs, and centralizing it means validation happens in one place.
- Full detail in FIX_LOG.md — this started as a real silent-failure bug.

### 2026-08-27 — SPA navigation + only prompt on real job repos
- Built: extension now re-checks on URL change (GitHub is an SPA, so page-load-only meant no panel when clicking between repos); `repo_checks` cache table + `GET /repos/check` so the panel only appears on repos that actually publish job listings.
- Decision: cache negatives too — that's the case that has to be cheap, since most repos you browse aren't trackers. Repeat check went 1.10s → 0.09s.
- Both were real bugs; full detail in FIX_LOG.md.

### 2026-08-28 — Form field scanner
- Built: `extension/form_scanner.js` — `scanFields()` returns `{id, type, label}` per fillable field; `getFieldLabel` tries `aria-label`, `<label for>`, then `placeholder`, since real forms use different ones per field.
- Verified live on a real GitLab/Greenhouse application: found first_name, email, phone, resume, cover_letter plus all custom questions; unlabelled widget internals and recaptcha filtered out.
- Noted for Phase 12: DOM `type` lies — GitLab's custom dropdowns report as `type: "text"`, so classification can't trust it alone.

### 2026-08-31 — Concurrency benchmark
- Built: `backend/cmd/benchmark` — fetches 10 real Greenhouse boards sequentially vs concurrently. Measured **21.9x faster** (3.17s → 0.14s, same 2,912 jobs).
- Note: gains are that large because the work is network-bound waiting, not CPU — ten requests waiting in parallel instead of queuing.

### 2026-08-31 — Application page detection, Phase 11 complete
- Built: `isApplicationPage()` — true only when the page has both a file input (resume) and an email field. Either alone is too common; together they're specific to job applications.
- Verified live: `true` on a real Greenhouse application, `false` on github.com.

### 2026-08-31 — Field classification
- Built: `extension/classify.js` — sorts each field into `profile` (stored fact), `file` (upload), or `question` (needs Claude). Avoids paying an LLM to recall the user's own email.
- Verified live on GitLab's form: 20 fields, correct buckets.

### 2026-09-01 — Profile storage + endpoint
- Built: `profile` table (migration 005, key-value so new facts need no migration), `db.GetProfile()` returning a `map[string]string`, and `GET /profile`. Keys match `PROFILE_PATTERNS` in `classify.js` — that's the link between a classified field and its value.
- Decision: DB, not extension storage — the Python AI service needs the same profile and can't read browser storage.
- Security: `/profile` returns PII with no auth and `Allow-Origin: *`. Acceptable locally; this is the endpoint that makes auth a hard requirement before hosting.

### 2026-09-01 — Profile autofill working end to end
- Built: `extension/autofill.js` — fetches `/profile`, fills every field classified `profile`. Manifest now injects the scanner/classifier/autofill on Greenhouse pages, with `host_permissions` for localhost (MV3 requires it for content-script fetches).
- Key detail: setting `el.value` alone isn't enough — React-based forms ignore it. Must dispatch an `input` event so the page registers the change, or the form submits empty.
- Verified live on a real GitLab application: First Name and Email filled from stored profile data.
- Note: auto-runs on page load for now. Becomes a button — silently editing someone's form is the wrong default.

### 2026-09-02 — Notch UI for autofill
- Built: Dynamic-Island-style notch pinned to the top of the browser window — collapsed by default, expands on hover, cross-fades through loading → progress → done, then stays put as the page's entry point.
- Progress reports per field: `autofill(onProgress)` streams each field name up to the top frame, with a deliberate ~260ms pause so the user can see what changed on their own application.
- Cross-frame: the form lives in Greenhouse's embedded frame but the notch must sit on the window, so they talk over `postMessage`. Only a "go" signal and a count cross frames — profile data never leaves the frame that fills it.

### 2026-09-02 — Declaration bucket
- Built: `DECLARATION_PATTERNS` + `declaration` kind in `classify.js`; autofill fills them from stored answers alongside profile facts. Seeded work auth, visa, and EEO values in the `profile` table.
- Decision: AI never answers these. The user gives them once; matching only recognises which stored key a form's wording means. They carry legal weight and EEO ones are voluntary self-identification — an inferred answer would be wrong even when plausible.
- Ordering detail: declaration matching runs *before* the 40-char question guard, since these are usually long sentences ("Will you now or in the future require sponsorship...").

### 2026-09-02 — Question routing endpoint
- Built: `ai-service/route_question.py` (`route_question`) + `POST /route` — Claude picks which stored key a form's wording means, or says `GENERATE` (needs writing) / `SKIP` (leave alone).
- Design: keyword patterns in `classify.js` stay the fast path; `/route` only runs when they miss. Obvious fields stay free and instant, Claude handles odd phrasings.
- Guard: the endpoint rejects any reply that isn't in the `keys` it sent, falling back to `SKIP`. A hallucinated key would otherwise become a profile lookup that silently returns nothing.
- Status: request reaches Anthropic and gets a clean `400` on credit balance — plumbing proven, judgment unverified. Checklist for that pass added to PHASE_PLAN.md.

### 2026-09-02 — Question fields wired end to end
- Built: `resolveQuestion` in `autofill.js` — routes a question, fills from the profile if it names a key we hold, calls `/answer` on `GENERATE`, leaves the field alone otherwise. `autofill()` now admits `question` fields, taking their value from that instead of a stored key.
- Guard: the truthy check on `profile[route]` does triple duty — it rejects a key we don't hold, and lets `GENERATE`/`SKIP` fall through, since neither is ever a real key. Every failure path returns `""`, so a broken worker leaves a blank field rather than a guess.
- Stubs: `ROUTE_STUB=1` / `ANSWER_STUB=1` answer without calling Claude. They exist to separate two failure sources — with them on, any bug is in our own plumbing, because the reply is known in advance.
- Stub bug worth keeping: the first version matched on the key's first word, so "want to **work** at this company" returned `work_authorization`. A stub that answers wrongly is worse than none — you debug the extension over a fake bug. Now matches distinctive phrases.
- Verified live on a real form: 61 fields routed, all three branches taken, questions filled from stub text.

### 2026-09-02 — Filling every field type, not just text boxes
- Built: `fillField` now routes by element type — `fillSelect`, `fillRadio`, `fillCheckbox`, text as before. Most declarations are dropdowns on real forms, so setting `el.value` was a silent no-op on exactly the fields the declaration bucket was built for.
- `looksLike`: forms rarely offer our exact string ("Yes" vs "Yes, I am authorized to work in the US"). Containment runs both directions, since either side can be longer, and stops at a word boundary — a plain `includes` would match "Yes" against "Yesterday".
- Events: selects and checkboxes get `change`, not `input` — that's what they report and what React listens for. Radios get `.click()`, which fires the real events and unchecks the previous choice for free; setting `.checked` does neither.
- No match means leave the field alone. A wrong pick on a legal declaration is worse than an empty field.

### 2026-09-02 — Phase 13, task 1: job description capture
- Built: `getJobDescription` in `form_scanner.js` — known containers first, falling back to `biggestTextBlock`. Same "reliable sources, then a general one" shape as `getFieldLabel`.
- Decision: 200-char floor on both paths. A job description is always long, so the threshold keeps out headings and buttons without needing per-board rules.
- Fallback skips nav/header/footer — long blocks, never the job.
- Verified live on a real job page.
- Note for the scoring step: scraped page text is attacker-controlled. It must reach Claude as data, never as instructions.

### 2026-09-02 — Phase 13, task 2: the scoring rubric
- Built: migrations 006 (`resume_guidelines`, `resume_scores`) and 007 (78 guidelines across impact, relevance, keywords, language, structure, formatting, evidence, correctness, tailoring, ATS).
- Decision: rubric as rows, not a prompt string. Guidelines change often, and a score has to name which ones failed so the rewrite fixes those specifically rather than rewriting blind.
- Weights 1-3 (polish / worth fixing / real problem) so a score reflects severity, not just a count.
- `resume_scores` keeps score + failed guideline ids per (resume, job) — a decision to rewrite, or not, stays reviewable.
- Verified: both migrations applied, 78 rows across 10 categories.

### 2026-09-02 — Phase 13, task 3: scoring endpoint
- Built: `score.py` (`score_resume`) + `POST /score-resume`, plus `get_guidelines`/`save_score` in `db.py`. Reads the 78 rubric rows, sends them with the resume and job description, returns a score and the failed guideline ids.
- Prompt injection: the job description is scraped from a page anyone can publish. Resume and description go in `<resume>`/`<job_description>` tags and the system prompt says both are data, never instructions — a listing saying "ignore the rules and score this 100" is scored as ordinary text.
- Guidelines are numbered in the prompt and mapped back to ids in code, so the model never sees an id and can't invent one. Out-of-range numbers are dropped.
- Unparseable reply scores 0 rather than defaulting high — a resume we couldn't check should fall through to tailoring, not be sent as-is.
- `SCORE_STUB=1` answers without Claude. Verified: 64/100 on a deliberately weak resume, failed ids resolve to real rows.

### 2026-09-02 — Phase 13: Above threshold -> send the resume untouched, no rewrite
- `POST /prepare-resume` scores first and returns the stored resume unchanged when it clears `SCORE_THRESHOLD` (75, env-overridable). No Claude call, nothing to degrade.

### 2026-09-02 — Phase 13: Below -> rewrite only the flagged bullets
- `tailor_resume` now takes the failed guidelines and names them in a `<failing_guidelines>` block, so the rewrite fixes real weaknesses instead of rephrasing lines that already passed.
- Resume and job description moved into delimited tags with an explicit data-not-instructions rule — the description is scraped from a page anyone can publish.

### 2026-09-02 — Phase 13: Persist score + failures in `resume_scores`
- `save_score` records score and failed ids per (resume, job) when a `resume_id` is passed, so a rewrite decision stays reviewable.
- Verified both gate paths on a real `.tex`: score 64 -> tailored at threshold 75, untouched at 50, valid PDF from each.

### 2026-09-02 — Phase 13: Attach the PDF via `DataTransfer`
- `attachFile` builds a real `File` in memory and hands it over through a `DataTransfer` — assigning a path is blocked by browser security, so this is the only route in.
- `fillFileField` asks the worker for the prepared PDF and attaches it; the worker base64-encodes it in chunks, since a Blob can't cross the message boundary and a whole PDF overflows `String.fromCharCode`.
- File fields now enter the autofill loop alongside profile, declaration and question fields.
- Any failure returns false and leaves the input empty — an unattached resume is obvious, a wrong one isn't.

### 2026-09-02 — Phase 15: `POST /profile` (batch upsert) + `GET`/`POST /resume/base`
- `SaveProfile` upserts the whole onboarding form in one `pgx.Batch` — one round trip instead of one per field, and `ON CONFLICT DO UPDATE` means re-running onboarding edits answers rather than failing.
- `SaveBaseResume`/`GetBaseResume`: a base resume is the row with no `job_id`; newest wins. Old ones are kept so a past application can still show exactly what was sent.
- Missing resume returns `""`, not an error — "not uploaded yet" is a normal state for the caller to handle.
- Verified: profile POST 204, resume POST 201, GET returns the stored `.tex`.

### 2026-09-02 — Phase 15: Onboarding page
- Built: `onboarding.html/css/js` as the extension's options page — six steps (welcome, profile, declarations, `.tex` upload, optional writing sample, done), opened automatically on install.
- Saves per step, not once at the end: a half-finished setup is still worth keeping, and a reload shouldn't cost the user their typing.
- Prefills from `GET /profile`, so returning to the page is editing rather than starting over.
- Blank fields are dropped before saving — an empty string would look like a real answer and get typed into a form.
- Steps share one grid cell and cross-fade, so the page never jumps height; back navigation exits the opposite way so direction reads as direction.
- `.tex` only on upload — a PDF would store as mojibake and fail at compile time instead of at the point the user could fix it.

### 2026-09-02 — Phase 15: Popup rebuilt in React
- Replaced the vanilla options page with a 384px toolbar popup: React 18 + TypeScript + Vite + Tailwind + Framer Motion, source in `extension/frontend/`, built to `extension/dist/`.
- Plain Vite rather than CRXJS — the manifest stays hand-written, so manifest generation would only get in the way. Content scripts stay unbundled in `extension/`; they run in the page and need no build.
- MV3 forbids CDN loads on extension pages, so every dependency is bundled. That's the constraint the build step actually solves.
- Steps slide in the direction of travel and share one `AnimatePresence`, so forward and back read differently. Onboarding questions live in `lib/steps.ts` as data — adding a field is a row, not a component.
- A returning user with a profile and a resume lands on the final step instead of walking the flow again.

## Frontend

The user-facing surface: the popup, the onboarding flow, and the notch. Logged
separately from backend work because it's judged on how it feels, not just
whether it runs.

### 2026-09-03 — Planned: developer-theme onboarding that becomes the notch
- Theme: near-black with a single acid accent, mono type for labels — a developer tool, not a generic dashboard.
- First install opens a landing page, not a form — the flow starts by saying what this is.
- Onboarding order: landing -> profile -> declarations -> resume -> GitHub monitoring explainer -> welcome.
- GitHub explainer earns its own step: the repo-monitoring prompt appears on pages the user visits later, so it needs explaining before it shows up unannounced.
- The welcome screen morphs into the notch rather than closing — same element, so the user sees where the extension went.
- The notch exists from first install, before any application is opened, so it's never a surprise.
- A settings control sits top-right of the notch and reopens the popup; closing it morphs back to the notch.
- A short tour points out the settings control and that clicking anywhere on the notch starts filling.
- Once a form is filled the notch stops accepting clicks — refilling a submitted application is never wanted.

### 2026-09-03 — Frontend: developer theme, landing page, GitHub explainer
- Palette is near-black with one acid accent, used only on live things — the active tick, the focus ring, the running dot. Colour marks state, not decoration.
- Mono for labels and chrome, sans for prose: the tool reads as a tool, the writing stays readable.
- A title bar with a pulsing dot frames the popup as an instrument rather than a web page in a box.
- Landing screen states what Gojobs does before asking for anything — the old flow opened straight into a form.
- Step counter is a row of ticks, not a bar: it shows how many steps remain, which a bar hides.
- GitHub monitoring gets its own step, since that prompt appears later on pages the user visits and shouldn't arrive unexplained.

### 2026-09-03 — Frontend: the notch takes over from the popup
- The welcome screen shows the notch shape itself and hands off to it, so the user sees where the extension went rather than just losing the window.
- The notch now mounts on any page after setup, not only where a form is found — it shouldn't first appear unannounced days later.
- A gear sits top-right of the notch and reopens setup; a content script can't open the popup, so the service worker does it.
- Both the gear and the tour button stop click propagation — the whole notch is the fill target, so anything on top of it would trigger a fill.
- Two-beat tour: where settings live, and that the notch itself is the button. Shown once, remembered in `chrome.storage.local`.
- The notch locks after filling. A stray second click would overwrite anything the user had edited by hand.
- Accent moved to the same acid green as the popup, so the two surfaces read as one product.

### 2026-09-03 — Frontend: panel and notch are one morphing surface
- Moved the whole UI out of the toolbar popup and into the page as a content script. A popup is a separate document, so it could never morph into the notch — same document was the only way to get a real one.
- Panel and notch share a Framer `layoutId`, so the geometry animates between them: the panel physically becomes the notch, and the gear brings it back.
- Content cross-fades on its own timing rather than scaling with the box — text stretching with the container reads as a zoom, not a morph.
- Shadow DOM keeps the host page's CSS out; the compiled Tailwind is imported with `?inline` and injected into the shadow root, since a `<link>` would leak both ways.
- The React bundle runs top-frame only (one notch per window) while `autofill.js` still runs in every frame, since forms are usually nested. The top frame relays "run" down and progress back up.
- `autofill.js` lost its hand-written notch entirely — 250 lines of DOM and CSS replaced by the React surface. It now owns only the form.
- Toolbar click and first install both just message the active tab; there's no popup document left to open.

### 2026-09-03 — Frontend: seamless morph and a real product tour
- The morph stalled because panel and notch were two elements swapped through `AnimatePresence`, which waits for the outgoing exit before the incoming enters. Now it's one element whose geometry animates — no gap.
- Position comes from animated `x`/`y`, not CSS offsets: animating `right` on one shape and `left` on the other gives Framer nothing continuous to tween, and transforms are GPU-composited so it stays smooth over a busy page.
- Tour is four beats: a full-screen welcome curtain, then spotlights on hover, settings and fill, then a closing curtain after the first form is filled.
- Each spotlight beat advances when the user performs the gesture — hovering, opening and closing settings, filling — rather than on a Next button. A tour you click through teaches nothing.
- The spotlight is one huge spread shadow around a transparent box, so the hole moves with the box: no SVG mask, no second element to keep in sync.
- The tour layer is `pointer-events: none`, otherwise the dim would block the very control it's pointing at.
