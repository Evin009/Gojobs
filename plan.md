# Job Application Autofill Agent — Project Plan

## Idea
System that monitors job boards/repos for new postings matching your criteria, alerts you on Slack, then autofills the application (including AI-judgment fields) with a LaTeX-tailored resume and custom cover letter.

## Features

1. **Job monitoring — Greenhouse** — poll public Greenhouse JSON API per company, filter by keyword (e.g. "software engineering intern").
2. **Job monitoring — GitHub repos** — watch tracker repos (e.g. "Summer2026-Internships"), diff commits/README for new posting rows.
3. **Slack notification** — alert user the moment a new matching posting is found from either source.
4. **Resume tailoring (LaTeX)** — take user's raw `.tex` resume, AI rewrites/inserts keywords into bullet content only, structure/commands untouched, recompiled to PDF.
5. **Cover letter generation** — AI writes cover letter in user's own voice, style learned from past writing samples.
6. **Style memory** — vector store of past resumes/cover letters/essays, retrieved per task for consistent tone.
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
   - Postgres client
   |
   |--> Postgres (users, resumes [.tex], jobs, applications/tracker, writing_samples)
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

## Postgres Schema (rough)
- `users` — account info
- `resumes` — raw `.tex` content, versioned
- `jobs` — company, role, description, url, source (greenhouse/github)
- `applications` — tracker: job_id, resume_version, status, date_applied
- `writing_samples` — raw text used to seed vector DB

## Tech Stack
| Layer | Tech |
|---|---|
| Extension | JavaScript/TypeScript, Manifest V3 |
| Backend | Go (`net/http` or `chi`/`gin`) |
| Backend DB | Postgres |
| Concurrency | Go goroutines (multi-company/repo polling) |
| Notifications | Slack webhook |
| AI service | Python, FastAPI |
| Agent framework | LangChain / LangGraph |
| Vector store | Chroma (embedded, no separate infra) |
| LLM | Claude API (Anthropic) |
| Resume format | LaTeX (`.tex` in, `.tex` out, compiled via `pdflatex`/`tectonic`) |
| Infra (later) | Docker, docker-compose |

## Why this stack
- Go: fast concurrent I/O layer — polling, routing, DB, orchestration. Mirrors real industry use (K8s, Docker, Uber-style backend infra).
- Python: richest AI/agent tooling (LangChain/LangGraph, official Claude SDK, vector DB libraries).
- Split mirrors common real-world pattern: infra/backend language + specialized ML/AI service.
