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

### Found

### Fixed

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
- [ ] Settings section in the extension panel, separate from onboarding
- [ ] Slack webhook stored in the DB and editable, not hardcoded
- [ ] Slack on/off toggle — notifications are opt-in, not assumed
- [ ] Greenhouse company list editable, not hardcoded in `main.go`
- [ ] Personal info editable from the same place

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
