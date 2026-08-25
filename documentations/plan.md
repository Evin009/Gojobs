# Job Application Autofill Agent — Project Plan

## Idea
System that monitors job boards/repos for new postings matching your criteria, alerts you on Slack, then autofills the application (including AI-judgment fields) with a LaTeX-tailored resume and custom cover letter.

## Features

1. **Job monitoring — Greenhouse** — poll public Greenhouse JSON API per company, filter by keyword (e.g. "software engineering intern").
2. **Job monitoring — GitHub repos** — watch tracker repos (e.g. "Summer2026-Internships") via their JSON listings feed; repo list is dynamic (stored in DB), not hardcoded — user adds repos via the extension's "monitor this repo?" popup shown when they visit a GitHub repo page (Phase 11+).
3. **Slack notification** — alert user the moment a new matching posting is found from either source.
4. **Resume tailoring (LaTeX)** — take user's raw `.tex` resume, AI rewrites/inserts keywords into bullet content only, structure/commands untouched, recompiled to PDF. Every job gets its own tailored version — each is saved as a new row (not overwritten), linked to the specific application it was used for, so past applications always show exactly which resume version was sent.
5. **Cover letter generation** — AI writes cover letter in user's own voice when style samples exist; falls back to a solid, professional AI-generated letter otherwise. **Optional touch, not a requirement** — user chooses whether they want style-matching at all.
6. **Style memory** — vector store of past resumes/cover letters/essays, retrieved per task for consistent tone. No hard dependency on samples existing — the resume text itself is always a free, implicit style signal even before any dedicated samples are uploaded.
7. **Full autofill w/ AI judgment** — detects all form field types (text/dropdown/radio/checkbox/essay); deterministic fill for known fields, AI-generated answers for open-ended/judgment fields.
8. **Tracker board** — kanban (Applied / OA / Interview / Offer / Rejected), auto-updated on each application.

## Architecture

```
Go Backend (cron + goroutines)
   - /monitor/greenhouse   (poll ATS JSON APIs concurrently)
   - /monitor/github       (poll/diff tracker repos)
   - Slack webhook on match
   - /jobs/process         (orchestrates tailoring + autofill pipeline)
   - /tracker              (CRUD)
   - Supabase client (Postgres + Auth)
   |
   |--> Supabase Postgres (users, resumes [.tex], jobs, applications/tracker, writing_samples)
   |--> Supabase Auth (user accounts, sessions)
   |
   |  HTTP
   v
Python AI Service (FastAPI)
   - LangChain / LangGraph agent
   - Vector store (Chroma) — style retrieval (RAG)
   - LaTeX resume editor (bullet-only edits)
   - Field-answer generator (autofill judgment fields)
   - Calls Claude API
   |
   v
Claude API
```

Extension (JS/TS, Manifest V3) handles on-page form field detection + fill, triggered when user opens an application page.

## Supabase (Postgres) Schema (rough)
- `users` — account info (Supabase Auth handles auth itself; this table holds app-specific profile data linked to `auth.users`)
- `resumes` — raw `.tex` content, one row per tailored version (base resume + one new row per job it's tailored for, never overwritten)
- `jobs` — company, role, description, url, source (greenhouse/github)
- `monitored_repos` — url, added_at (dynamic GitHub repo list, user-added via extension popup)
- `applications` — tracker: job_id, resume_id (which tailored version was actually used), status, date_applied
- `writing_samples` — raw text used to seed vector DB

## Tech Stack
| Layer | Tech |
|---|---|
| Extension | JavaScript/TypeScript, Manifest V3 |
| Backend | Go (`net/http` or `chi`/`gin`) |
| Backend DB + Auth | Supabase (managed Postgres + Auth + RLS) |
| Concurrency | Go goroutines (multi-company/repo polling) |
| Notifications | Slack webhook |
| AI service | Python, FastAPI |
| Agent framework | LangChain / LangGraph |
| Vector store | Chroma (embedded, no separate infra) |
| LLM | Claude API (Anthropic) |
| Resume format | LaTeX (`.tex` in, `.tex` out, compiled via `pdflatex`/`tectonic`) |
| Infra (later) | Docker, docker-compose |

## Hosting (future — review later)
- **Decision leaning:** always-on host (Railway/Fly.io/Render), not serverless cron.
- **Why:** extension needs a live synchronous API anyway (login, add-repo, tracker CRUD) — that means an always-on server either way, so monitoring should live in the same process rather than a second deployment target. Serverless functions also cap execution time, risky once monitoring covers many users' companies/repos in one run.
- **Multi-tenant note:** hosting choice doesn't solve multi-user support by itself — that needs per-user companies/keywords/Slack webhook (application-level change). `monitored_repos` already being DB-backed instead of hardcoded is a head start on that pattern.
- Not started — revisit when ready to actually deploy.

## Onboarding (future — review later)
- **Idea:** a short onboarding flow (few quick prompts, e.g. "write 2-3 sentences about why you want this kind of role") to bootstrap real user data day one — a starter writing sample, and groundwork for later phases where the autofill agent needs user-specific data to answer open-ended application questions (Phase 12).
- **Why now, not later:** the same "collect a bit of user data upfront" pattern that seeds style memory today is what Phase 12's AI-judgment autofill will lean on — worth designing once, reusing twice.
- Not started — revisit when building Phase 10 ingestion or Phase 12 autofill.

## Why this stack
- Go: fast concurrent I/O layer — polling, routing, DB, orchestration. Mirrors real industry use (K8s, Docker, Uber-style backend infra).
- Python: richest AI/agent tooling (LangChain/LangGraph, official Claude SDK, vector DB libraries).
- Split mirrors common real-world pattern: infra/backend language + specialized ML/AI service.
