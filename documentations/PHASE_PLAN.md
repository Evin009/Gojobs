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
- [ ] AI maps a form's wording -> a stored declaration key — built, answers unverified (credits)
- [ ] AI writes answers for open-ended questions — built, answers unverified (credits)
- [x] Wire `autofill.js` to the question bucket — all three branches verified against stubs
- [x] Fill dropdowns, radios and checkboxes — `fillField` routes by element type
- [x] Match a stored value to a near-miss option — `looksLike`, both directions, word-boundary safe
- [x] Find radios by `name` — `findElement` falls back from `id`
- [ ] Attach resume / cover letter — moved to Phase 13

## Phase 13 — Scored resume tailoring + attachment

Read the job description -> score the resume -> rewrite only if it falls short
-> compile -> attach. Tailoring and compiling exist (Phase 8); the gate and the
attachment are new. Full reasoning in plan.md.

- [x] Capture the job description from the application page — `getJobDescription`, verified live
- [x] `resume_guidelines` table + seed the ~80 guidelines — 78 rows across 10 categories, applied and verified
- [x] `POST /score-resume` — score out of 100 + which guidelines failed (verified against `SCORE_STUB`)
- [x] Above threshold -> send the resume untouched, no rewrite
- [x] Below -> rewrite only the flagged bullets
- [x] Persist score + failures in `resume_scores`
- [x] Attach the PDF via `DataTransfer` — built; untested in a browser
- [ ] Pick the thresholds from real scores, not a guess (moved into Phase 14's loop)

## Phase 14 — Two-axis scoring + rewrite loop

One score can't say both "does this match the job" and "will a parser read it".
Split them, rewrite against Google's XYZ format, then rescore — repeating until
both clear or a cap is hit, so a rewrite is checked rather than assumed.

- [x] Store the user's base `.tex` resume and serve it — `GET`/`POST /resume/base`, verified round-trip
- [ ] Split scoring into JD match /100 and ATS friendliness /10, both from one call
- [ ] Rewrite bullets in XYZ form: accomplished X, measured by Y, by doing Z
- [ ] Loop: score -> rewrite -> rescore, stopping when both clear or after 3 passes
- [ ] Keep every pass in `resume_scores` so the improvement is visible
- [ ] Bail out if a rewrite scores worse than what it replaced
- [ ] One prepared resume cached per job — never re-run the loop for the same posting

## Phase 15 — Onboarding UI

Replaces hand-seeded SQL with data the user actually gives us, and is the first
user-facing surface of the product.

- [x] `POST /profile` (batch upsert) + `GET`/`POST /resume/base`
- [x] Onboarding page: profile facts, declarations, `.tex` resume, optional cover letter
- [x] Open it automatically on install
- [x] Show whether onboarding is complete, and let the user re-edit answers — the page prefills from stored data
- [ ] Autofill reads only stored data — no seeded rows left
- [x] Developer theme: near-black, one accent, mono labels
- [x] Landing page on first install, before the form
- [x] GitHub monitoring explainer as its own onboarding step
- [ ] Welcome screen morphs into the notch
- [ ] Notch exists from first install, not only on application pages
- [ ] Settings control on the notch reopens the popup, and morphs back on close
- [ ] Notch tour: settings control, and click anywhere to fill
- [ ] Notch stops accepting clicks once a form is filled

## Phase 16 — Tracker board
- [ ] Kanban CRUD, auto-updated on apply

## Blocked on Anthropic credits — verify these together in one pass

Every Claude call reaches the API (confirmed by a real `400` on credit balance).
None of the answers have been seen. Run these in one pass once credits land.

**Phase 7 — `/ask`**
- [ ] Returns real text for a plain prompt
- [ ] `claude-opus-5` is a valid model id (all five call sites)

**Phase 8 — `/tailor-resume`**
- [ ] Claude returns `.tex`, not prose or a fenced code block
- [ ] LaTeX structure untouched — only bullet content rewritten
- [ ] Output still compiles via tectonic
- [ ] Lands as a new `resumes` row, old one intact

**Phase 9 — `/cover-letter`**
- [ ] Returns a plain-text letter, no markdown wrapper
- [ ] Retrieved style samples actually shift the voice

**Phase 12 — `/answer`**
- [ ] Answer is grounded in the resume/profile, not invented
- [ ] `UNKNOWN` fires when context can't support an answer; field left blank

**Phase 12 — `/route`** (the routing prompt, most worth checking)
- [ ] Reworded declaration maps to the right key
- [ ] `work_authorization` vs `visa_sponsorship` don't collide — opposite answers, similar wording
- [ ] Open-ended question returns exactly `GENERATE`
- [ ] Unmappable question (reference phone number) returns exactly `SKIP`
- [ ] Reply is one bare word — punctuation would break key lookup
- [ ] `max_tokens=20` is enough for the longest key
- [ ] Hallucinated-key guard fires — send a `keys` list missing the match, expect `SKIP`

**Phase 13 — scoring + attachment**
- [ ] `/tailor-resume` returns a PDF good enough to actually send
- [ ] `/score-resume` gives stable scores across repeat runs
- [ ] A strong resume clears the threshold and is sent untouched
- [ ] A weak one fails, and the rewrite addresses what failed
- [ ] The generated resume attaches to a real form's file input and survives submit

**End to end, in the browser**
- [ ] Unmatched question routes and fills from the returned key
- [ ] `GENERATE` reaches `/answer` and writes something usable
- [ ] `SKIP` leaves the field untouched
