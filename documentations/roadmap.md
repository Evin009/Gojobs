# Build Roadmap

Ordered by dependency + learning curve. Each phase = working, testable piece. Follows agent.md mentor rules — no full features dumped, checkpoints between phases.

## Phase 0 — Environment
Install Go, Python venv, create Supabase project. Verify each runs. (Boilerplate, I set this up, you verify.)

## Phase 1 — Go backend skeleton
Single `/health` endpoint, connect to Supabase Postgres, confirm query works.
**Learn:** Go project structure, `net/http` or `chi`, DB driver basics, Supabase connection string.

## Phase 2 — Greenhouse monitor (single company)
Go hits one Greenhouse JSON API, parses response, prints matching jobs.
**Learn:** HTTP client in Go, JSON unmarshaling, structs.

## Phase 3 — Persist + dedupe
Save fetched postings to Supabase `jobs` table. Skip ones already seen.
**Learn:** SQL inserts, basic query, simple diff logic, RLS basics (why it matters even for a solo backend service).

## Phase 4 — Slack notify
POST to Slack webhook when a new job is found.
**Learn:** simple outbound HTTP call, webhook payload format.

## Phase 5 — Concurrency + scheduling
Poll 5-10 companies concurrently via goroutines, repeat on interval (cron).
**Learn:** goroutines, channels, `time.Ticker`.

## Phase 6 — GitHub repo monitor
Second data source, reuse Phase 2-5 pattern (fetch JSON listings feed + notify). Repo list is dynamic — stored in a new `monitored_repos` Supabase table, not hardcoded — so it's ready for the extension to add repos later (Phase 11+).
**Learn:** GitHub API/JSON listings feeds, applying an established pattern to new input, designing for a not-yet-built consumer (the extension).

## Phase 7 — Python AI service skeleton
FastAPI hello-world, one endpoint that calls Claude API directly (no LangChain yet).
**Learn:** FastAPI basics, Claude API call/response shape.

## Phase 8 — LaTeX resume tailoring
Feed `.tex` + job description to Claude, get edited `.tex` back, compile to PDF.
**Learn:** prompt constraints (edit bullets only), LaTeX compile step.

## Phase 9 — Cover letter generation
Reuse Phase 8's Claude-call pattern for a new prompt/output type.
**Learn:** prompt reuse, output formatting differences.

## Phase 10 — Style memory (vector DB)
Introduce Chroma + LangChain. Embed past writing samples, retrieve relevant ones per task.
**Learn:** embeddings, vector search, RAG basics.

## Phase 11 — Extension skeleton
Manifest V3 extension, detect job application page, read form fields. Also: when the user visits any GitHub repo page, show a popup asking "monitor this repo for updates?" — on click, calls the backend to add it to `monitored_repos` (built in Phase 6).
**Learn:** content scripts, DOM access, extension permissions.

## Phase 12 — AI-judgment autofill
Classify field types, deterministic fill for known fields, AI-generated answers for open-ended ones.
**Learn:** field-type detection, tying AI output back into DOM.

## Phase 13 — Tracker board
Kanban CRUD (Applied/OA/Interview/Offer/Rejected), auto-updated on apply.
**Learn:** simple frontend/API tie-together, wraps the whole flow.

---

**Why this order:** Go+Supabase fundamentals first (phases 1-6, no AI yet — simplest layer). Then simplest possible AI call (phase 7-9, no agent framework). Then add real complexity last (RAG, extension DOM work, judgment fields) once fundamentals are solid.

Start at Phase 0/1 whenever ready.
