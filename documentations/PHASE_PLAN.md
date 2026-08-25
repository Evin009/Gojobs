# Phase Plan — Checklist

Tracks what's done vs pending per phase. Full detail in `roadmap.md`, decisions/history in `BUILD_LOG.md`. Update after each task closes.

## Phase 0 — Environment
- [x] Go, Python, Supabase project set up and verified

## Phase 1 — Go backend skeleton
- [x] `/health`, `/ping` routes working
- [x] Go connects to Supabase Postgres (`pgx` pool)
- [x] `jobs` table created, RLS enabled
- [x] `InsertJob` writes + dedupes, verified end to end

## Phase 2 — Greenhouse monitor (single company)
- [x] Go HTTP client hits Greenhouse JSON API
- [x] Parse response into Go structs
- [x] Print matching postings by keyword

## Phase 3 — Persist + dedupe
- [x] Save fetched postings via `InsertJob`
- [x] Confirm duplicates get skipped

## Phase 4 — Slack notify
- [x] POST to Slack webhook on new job found

## Phase 5 — Concurrency + scheduling
- [x] Poll multiple companies concurrently (goroutines)
- [x] Repeat on interval (`time.Ticker`)

## Phase 6 — GitHub repo monitor
- [x] `monitored_repos` Supabase table (dynamic repo list, not hardcoded)
- [x] Fetch + filter + save GitHub listings JSON feed (reuse monitor pattern)
- [x] Concurrent multi-repo monitor + notify via same batched Slack summary

## Phase 7 — Python AI service skeleton
- [x] FastAPI hello-world
- [ ] One endpoint calls Claude API directly

## Phase 8 — LaTeX resume tailoring
- [x] LaTeX compile step (`compile_latex`, via tectonic) — verified live, no Claude needed for this part
- [x] Feed `.tex` + job desc to Claude (`tailor_resume` + `/tailor-resume` wired) — pending credits to fully verify
- [x] Get edited `.tex` back, compile to PDF (pipeline chained, pending credits)
- [ ] Save each tailored version as a new `resumes` row, linked to the application via `resume_id` (not overwritten)

## Phase 9 — Cover letter generation
- [ ] Reuse Claude-call pattern for cover letters

## Phase 10 — Style memory (vector DB)
- [ ] Chroma + LangChain set up
- [ ] Embed + retrieve past writing samples

## Phase 11 — Extension skeleton
- [ ] Manifest V3 setup
- [ ] Detect job application page, read form fields
- [ ] "Monitor this repo?" popup on GitHub repo pages, calls backend to add to `monitored_repos`

## Phase 12 — AI-judgment autofill
- [ ] Classify field types
- [ ] Deterministic fill + AI-generated answers

## Phase 13 — Tracker board
- [ ] Kanban CRUD, auto-updated on apply
