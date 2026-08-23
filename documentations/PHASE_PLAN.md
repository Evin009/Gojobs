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
- [ ] Poll multiple companies concurrently (goroutines)
- [ ] Repeat on interval (`time.Ticker`)

## Phase 6 — GitHub repo monitor
- [ ] Second data source, reuse monitor pattern

## Phase 7 — Python AI service skeleton
- [ ] FastAPI hello-world
- [ ] One endpoint calls Claude API directly

## Phase 8 — LaTeX resume tailoring
- [ ] Feed `.tex` + job desc to Claude
- [ ] Get edited `.tex` back, compile to PDF

## Phase 9 — Cover letter generation
- [ ] Reuse Claude-call pattern for cover letters

## Phase 10 — Style memory (vector DB)
- [ ] Chroma + LangChain set up
- [ ] Embed + retrieve past writing samples

## Phase 11 — Extension skeleton
- [ ] Manifest V3 setup
- [ ] Detect job application page, read form fields

## Phase 12 — AI-judgment autofill
- [ ] Classify field types
- [ ] Deterministic fill + AI-generated answers

## Phase 13 — Tracker board
- [ ] Kanban CRUD, auto-updated on apply
