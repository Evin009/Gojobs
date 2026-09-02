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
- [x] Save each tailored version as a new `resumes` row, linked to the application via `resume_id` (not overwritten)

## Phase 9 — Cover letter generation
- [x] Reuse Claude-call pattern for cover letters

## Phase 10 — Style memory (vector DB)
- [x] Chroma set up — LangChain skipped for now, not needed for plain embed/retrieve (no agent/tool-calling here)
- [x] Embed + retrieve past writing samples — verified live
- [x] Wire retrieval into `/cover-letter` (pull relevant samples into the prompt)

## Phase 11 — Extension skeleton
- [x] Manifest V3 setup
- [x] Read form fields (`scanFields`, verified on a real Greenhouse form)
- [x] Detect that a page IS a job application (`isApplicationPage`, verified both ways)
- [x] Backend `POST /repos` endpoint for the extension to call
- [x] "Monitor this repo?" popup on GitHub repo pages, calls backend to add to `monitored_repos` — verified live in Chrome
- [x] Skip the prompt on already-monitored repos (`GET /repos` check, passive badge instead)
- [x] Re-run the panel on GitHub SPA navigation
- [x] Only prompt on repos that actually publish job listings (cached `GET /repos/check`)

## Phase 12 — AI-judgment autofill
- [x] Classify field types (`classify.js`, verified on a real form)
- [x] Deterministic fill for profile fields (name/email/phone/LinkedIn)
- [x] Store declarations as profile facts (seeded manually; onboarding UI still to build)
- [x] New `declaration` bucket in `classify.js` — verified on a real form
- [ ] AI maps a form's wording -> a stored declaration key (matching only, never generating) — `route_question.py` + `POST /route` wired and reaching the API; answers unverified (see credits section)
- [ ] AI-generated answers for genuinely open-ended questions only — `answer.py` + `POST /answer` + the `answerQuestion` relay in `background.js` are built; nothing in `autofill.js` calls them yet
- [x] Wire `autofill.js` to the question bucket: field -> `/route` -> stored key (fill) | `GENERATE` (-> `/answer`) | `SKIP` (leave blank) — verified live on a real form against `ROUTE_STUB`/`ANSWER_STUB`; all three branches exercised
- [ ] Attach resume / cover letter to file inputs — moved to Phase 13, where the PDF it attaches actually gets produced

## Phase 13 — Scored resume tailoring + attachment

The chain this phase completes: read the job description -> score the current
resume against it -> rewrite only if it falls short -> compile -> attach to the
form. Steps for tailoring and compiling already exist (Phase 8); what's new is
the scoring gate in front of them and the attachment at the end.

- [ ] Capture the job description from the application page (extension) — nothing does this today; the extension doesn't know which job it's filling
- [ ] `resume_guidelines` table + seed the ~80 guidelines (rubric as data, not a prompt string, so it can change without a deploy)
- [ ] `POST /score-resume` — resume + job description in; score out of 100 and the ids of failed guidelines out
- [ ] Gate: score above threshold -> send the stored resume untouched, skip tailoring entirely
- [ ] Below threshold -> feed the failed guidelines into `tailor_resume` so it fixes named weaknesses, not blind rewriting
- [ ] Persist score + failures in `resume_scores` — a rewrite decision should be reviewable later
- [ ] Attach the PDF to the form's file input — a file input can't be set from a path (browser security); build a `File` in memory, wrap it in a `DataTransfer`, assign to `input.files`
- [ ] Threshold value picked from real scores, not guessed

## Phase 14 — Tracker board
- [ ] Kanban CRUD, auto-updated on apply

## Blocked on Anthropic credits — verify these together in one pass

Every Claude call in the project is wired and reaches the API (confirmed by a real
structured `400` about credit balance, which means the key authenticates and the
request body is valid). None of the *answers* have been seen. Run these together
once credits are added.

**Phase 7 — `/ask`**
- [ ] Returns real text for a plain prompt
- [ ] `claude-opus-5` is a valid model id (used in all five call sites)

**Phase 8 — `/tailor-resume`**
- [ ] Claude returns `.tex`, not prose or a fenced code block
- [ ] LaTeX commands/structure untouched — only bullet *content* rewritten
- [ ] Output still compiles via tectonic (compile step already verified standalone)
- [ ] Tailored version lands as a new `resumes` row, old one intact

**Phase 9 — `/cover-letter`**
- [ ] Returns a plain-text letter, no markdown wrapper
- [ ] Retrieved style samples actually shift the voice (compare with samples removed)

**Phase 12 — `/answer`**
- [ ] Answer is grounded in the resume/profile passed in, not invented
- [ ] `UNKNOWN` path fires on a question the context can't support, and the field is left blank

**Phase 12 — `/route`** (the routing prompt, most worth checking)
- [ ] Reworded declaration maps to the right key ("Will you require sponsorship?" -> `visa_sponsorship`)
- [ ] Near-miss pairs don't collide — `work_authorization` vs `visa_sponsorship` are opposite answers to similar-sounding questions
- [ ] Open-ended question returns exactly `GENERATE`
- [ ] Unmappable question (reference phone number) returns exactly `SKIP`
- [ ] Reply is one bare word — no trailing period, no explanation (would break key lookup)
- [ ] `max_tokens=20` is enough for the longest key
- [ ] The hallucinated-key guard in `/route` fires — force it by sending a `keys` list missing the obvious match, expect `SKIP`

**Phase 13 — scoring + attachment**
- [ ] `/tailor-resume` returns a PDF good enough to actually send
- [ ] `/score-resume` gives stable scores — the same resume and job twice shouldn't swing wildly
- [ ] A strong resume scores above threshold and is sent untouched (the gate actually fires)
- [ ] A weak one scores below, and the rewrite addresses the guidelines that failed
- [ ] The generated resume attaches to a real form's file input and survives submit

**End to end, in the browser**
- [ ] Extension sends an unmatched question field to `/route` and fills from the returned key
- [ ] A `GENERATE` route reaches `/answer` and writes something usable
- [ ] A `SKIP` route leaves the field untouched — never a guess on a real application
