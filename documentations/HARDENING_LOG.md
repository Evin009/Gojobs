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
- [ ] Role categories (SWE, AI/ML, Product management, Product design, ...) replacing the single keyword list
- [ ] User picks which roles they want; monitoring filters on those
- [ ] Keyword sets per role, stored as data so a category can change without a deploy

**C — Jobs in the panel**
- [ ] Panel lists what monitoring has found, newest first, both sources
- [ ] Prove dedupe holds — the same posting must never appear twice
- [ ] Each row links out to the actual posting

**D — Dashboard stats**
- [ ] Total jobs found, and how many applied to
- [ ] "Applied" stays 0 until the tracker exists (Phase 16) — shown honestly, not hidden

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
