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

## Phase 1 — Go backend skeleton
_(in progress — next: Postgres connection)_
