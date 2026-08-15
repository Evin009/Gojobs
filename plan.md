# Job Application Autofill Agent — Project Plan

## Idea
Browser extension that detects a job posting, autofills the application form, tailors resume + writes cover letter in user's own style using an AI agent, and logs the job to a tracker board.

## Core Features
1. **Job detection & scraping** — extension detects job page, scrapes description, company, role, form fields.
2. **Resume tailoring** — AI agent rewrites/reorders resume bullets to match job description, ATS-friendly.
3. **Cover letter generation** — AI agent writes cover letter in user's own voice (style learned from past writing samples).
4. **Autofill** — extension fills detected form fields with generated/tailored data.
5. **Tracker board** — kanban-style board (Applied / OA / Interview / Offer / Rejected), auto-updated on each application.
6. **Style memory** — vector store of user's past resumes/cover letters/essays, retrieved per task for consistent tone.

## Architecture

```
Extension (JS/TS, Manifest V3)
   |
   |  HTTP
   v
Go Backend
   - Auth
   - /jobs/scrape        (goroutines, concurrent multi-site scraping)
   - /jobs/process        (orchestrates full pipeline)
   - /tracker              (CRUD)
   - Postgres client
   |
   |--> Postgres (users, resumes, jobs, applications/tracker, writing_samples)
   |
   |  HTTP
   v
Python AI Service (FastAPI)
   - LangChain / LangGraph agent
   - Vector store (Chroma) — style retrieval (RAG)
   - Calls Claude API
   |
   v
Claude API
```

### Data flow
1. Extension sends scraped job HTML to Go.
2. Go parses job desc + form fields, saves job to Postgres.
3. Go calls Python `/agent/tailor` with job desc + resume JSON.
4. Python agent retrieves relevant style samples from vector DB, builds prompt, calls Claude.
5. Response returns to Go, saved to Postgres, sent back to extension for autofill.
6. Tracker entry created/updated automatically.

## Postgres Schema (rough)
- `users` — account info
- `resumes` — structured JSON, versioned
- `jobs` — company, role, description, url
- `applications` — tracker: job_id, resume_version, status, date_applied
- `writing_samples` — raw text used to seed vector DB

## Tech Stack
| Layer | Tech |
|---|---|
| Extension | JavaScript/TypeScript, Manifest V3 |
| Backend | Go (`net/http` or `chi`/`gin`) |
| Backend DB | Postgres |
| Concurrency | Go goroutines (multi-site scraping) |
| AI service | Python, FastAPI |
| Agent framework | LangChain / LangGraph |
| Vector store | Chroma (embedded, no separate infra) |
| LLM | Claude API (Anthropic) |
| Resume rendering | Structured JSON -> PDF (LaTeX template or wkhtmltopdf) |
| Infra (later) | Docker, docker-compose |

## Why this stack
- Go: fast concurrent I/O layer — scraping, routing, DB, orchestration. Mirrors real industry use (K8s, Docker, Uber-style backend infra).
- Python: richest AI/agent tooling (LangChain/LangGraph, official Claude SDK, vector DB libraries).
- Split mirrors common real-world pattern: infra/backend language + specialized ML/AI service.
