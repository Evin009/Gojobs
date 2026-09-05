# Hardening Log

Making what exists production-ready, one feature at a time. Separate from
FIX_LOG (bugs found during building) — this tracks the deliberate pass over
each finished feature: what we tested, what broke, what changed.

One line per entry. Newest at the bottom of each feature's section.

**Order:** form filling -> form detection -> onboarding -> repo adding ->
job monitoring -> resume scoring. Most damaging first: a wrong answer on a
submitted application can't be taken back.

---

## 1. Form filling

Status: **scoping**

### Scope
_What this feature is responsible for, agreed before testing._

### Tested
- `GET`/`POST /settings` round-trip: read defaults, wrote a fourth company, read it back.

### Found
- Slack webhook was read straight from `SLACK_WEBHOOK_URL` with no way to change it, and no way to turn notifications off at all.
- `slack.Send` ignored the response status, so a wrong webhook URL failed silently — Slack answers 4xx, we called it success.
- No timeout on the Slack post: a hung webhook would hold a monitor goroutine open indefinitely.
- Greenhouse companies were hardcoded in `main.go`, so changing them meant editing and restarting.

### Fixed
- `settings` table (migration 008), key-value like `profile` so a new setting needs no migration; ships with defaults and Slack off.
- `slack.SendTo` takes the webhook as an argument, checks the status code, and carries a 10s timeout. Empty URL means "off", not an error.
- Companies are read fresh on every monitor run, so an edit lands at the next tick with no restart.
- Settings view in the panel: Slack toggle and webhook, companies as removable chips, a link into profile answers. The toolbar icon opens Settings for a returning user and setup for a new one.
- Company names are lowercased and de-duplicated on entry — Greenhouse board names are lowercase slugs, and a duplicate would double every posting from that company.
- The webhook field collapses away when notifications are off, rather than sitting there inert.
- Build environment: `node_modules` renamed to `node_modules.nosync` and symlinked. iCloud skips `.nosync`, so builds went from 2m42s to 1.4s.
- Discipline and level are separate axes. One combined list would have meant "any SWE job or any internship" when the user asked for SWE internships.
- An empty axis means "no filter here", never "match nothing" — otherwise clearing one group of checkboxes would silently stop all monitoring. Covered by a test.
- Matching moved into `internal/match`, shared by both sources so Greenhouse and GitHub can't drift on what counts as a match. Regexes are cached rather than recompiled per keyword per job.
- Whole-word matching kept throughout: "ml" must not match "html", "ai" must not match "email".
- Known limit: only titles are matched, since that's all the list endpoints return. A level stated only in the job body is invisible to this.
- `GET /jobs` returns the newest postings plus a total; the limit is capped at 200 and a bad `?limit=` falls back to the default rather than returning the whole table.
- Jobs view in the panel: counts first (the question is "is this working", which a number answers before a list does), then the postings, each linking out.
- Three distinct empty states — loading, backend unreachable, and genuinely nothing found. `getJobs` returns null rather than an empty feed so those stay distinguishable.
- "Applied" is sent as 0 rather than omitted, so the panel shows an honest zero instead of a gap until the tracker exists.
- Row stagger is capped at 15: past that the cascade stops reading as sequence and starts reading as lag.
- Toolbar icon opens Jobs, the notch gear opens Settings, tabs switch between them.
- Saved jobs are re-filtered against the current role settings on every request, so narrowing a filter changes the list and the count immediately instead of waiting for the next run. Verified: 103 -> 0 -> 103 switching between AI/ML and Design.
- The count is "today" — since midnight in America/New_York — not a rolling 24 hours. A count that resets at a predictable time is easier to trust than one that slides.
- Reset zone is EST fixed at UTC-5 all year, not `America/New_York` — that observes daylight saving, so the reset would drift by an hour twice a year. Fixed offset means midnight is the same moment every day.
- `last_checked` is written after a run completes, not before, so the panel can't claim a check that failed halfway. Shown in the header, so a stale panel is obvious.
- Rows lead with company, then role, then age and source; each has its own Apply button.
- Timestamps lose precision as they age: minutes, then hours, then days. The exact minute a week-old posting was found is noise.
- Co-op split out of Internship. Lumping them made every result look like a co-op — the tracker repos are co-op heavy. Now 80 co-ops vs 14 internships where there was one number of 103.
- Location was never saved: both sources return it and `InsertJob` dropped it. Migration 009 adds the column; rows saved before it show a dash until the next monitoring run.
- `internal/location` classifies a free-text location as us / canada / other / unknown. There's no country field on either source, so it's inferred from the string.
- Signals are checked strongest first — country name, then state code, then city name, then foreign country. "Vancouver, WA" was classifying as Canada until city names moved last.
- Single-word names match whole tokens only: "india" was matching inside "Indianapolis". Caught by a test, not by reading it.
- Unknown locations pass the filter. "Remote" is everywhere, and dropping what we can't parse would silently lose real matches — the same fail-open choice as the repo check.
- `other` is distinct from `unknown` on purpose: one means we recognised a foreign posting and can drop it, the other means we couldn't tell and shouldn't.

---

## 2. Form detection

Status: not started

---

## 3. Onboarding

Status: not started

---

## 4. Repo adding

Status: not started

---

## 5. Job monitoring

Status: **planned** — building this first, ahead of the stated order.

### Scope today
Polls Greenhouse companies and monitored GitHub repos every 30 minutes, keeps
postings matching a keyword list, saves new ones, sends one grouped Slack
message per run. No ranking, no descriptions, no applying.

### Plan

**A — Settings UI** (first: unblocks everything below)
- [x] Settings section in the extension panel, separate from onboarding
- [x] Slack webhook stored in the DB and editable, not hardcoded
- [x] Slack on/off toggle — notifications are opt-in, not assumed
- [x] Greenhouse company list editable, not hardcoded in `main.go`
- [x] Personal info editable from the same place — Settings links into the onboarding answers

**B — Role filters**
- [x] Role categories (SWE, AI/ML, Data, PM, Design, Security) replacing the single keyword list
- [x] Levels as a separate axis (Internship, New grad, Mid, Senior) — combined with AND, not OR
- [x] User picks both in Settings; monitoring reads them fresh every run
- [x] Keyword sets live in `internal/roles`, so fixing a missed job title is an edit, not a redesign

**C — Jobs in the panel**
- [x] Panel lists what monitoring has found, newest first, both sources
- [x] Each row links out to the actual posting
- [ ] Prove dedupe holds — the same posting must never appear twice

**D — Dashboard stats**
- [x] Total jobs found, and how many applied to
- [x] "Applied" stays 0 until the tracker exists (Phase 16) — shown honestly, not hidden

**E — Sponsorship filter** (last: needs descriptions, and costs money per job)
- [ ] Fetch the full description per posting — Greenhouse has a per-job endpoint; GitHub trackers link out and will sometimes fail
- [ ] Keyword pre-pass first: most descriptions that mention sponsorship use standard phrasing
- [ ] Claude classifies only the ambiguous ones — same fast-path/AI-fallback shape as `/route`
- [ ] Three verdicts: sponsors, explicitly will not, silent
- [ ] Cache the verdict per job — a description doesn't change, so classify once ever
- [ ] Expect "silent" to be the large majority; the filter is only as good as what companies actually write

### Tested

### Found

### Fixed

---

## 6. Resume scoring

Status: not started
