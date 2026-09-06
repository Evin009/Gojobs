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
- Location was never saved: both sources return it and `InsertJob` dropped it. Migration 009 adds the column; rows saved before it show a dash until the next monitoring run. Only 4 of 5017 existing rows have one, so the location filter and its counts stay near-empty until monitoring has run a few times.
- `internal/location` classifies a free-text location as us / canada / other / unknown. There's no country field on either source, so it's inferred from the string.
- Signals are checked strongest first — country name, then state code, then city name, then foreign country. "Vancouver, WA" was classifying as Canada until city names moved last.
- Single-word names match whole tokens only: "india" was matching inside "Indianapolis". Caught by a test, not by reading it.
- Unknown locations pass the filter. "Remote" is everywhere, and dropping what we can't parse would silently lose real matches — the same fail-open choice as the repo check.
- `other` is distinct from `unknown` on purpose: one means we recognised a foreign posting and can drop it, the other means we couldn't tell and shouldn't.
- Filters moved out of Settings and onto the Jobs panel, directly under the counts they change. Two screens away from the number they affect was the wrong place for them.
- Three custom multi-select dropdowns (Field, Type, Location), built from buttons — a native `<select multiple>` can't be styled and behaves badly inside a shadow root.
- Selecting applies immediately: writes the setting, refetches, updates the count. No Save anywhere in the filter path.
- Each dropdown says what "nothing selected" means ("Any", "Anywhere") rather than showing a blank, since an empty filter is a real choice here.
- Menus close on a backdrop click rather than a document listener — shadow-DOM event retargeting makes the latter unreliable.
- Each option shows how many of today's postings match it, counted independently of the other filters. A number that shifts every time a different filter changes can't be compared to anything — "US: 40" should mean forty US postings today, always.
- Region counts use exact classification rather than the filter's fail-open rule: counting unknown locations under both US and Canada would make the numbers meaningless.
- Menus size to their content rather than their trigger, so labels are never cut off. The last column opens leftwards to stay inside the panel.
- A zero count is dimmed rather than hidden — knowing an option has nothing today is worth more than a blank.
- Mid and senior levels removed. This is for students in tech; those two were noise, and their counts dwarfed everything else in the dropdown.
- "Last 30m" counter added beside Today, matching the monitoring interval, and counted inside the filter loop so it tracks the chosen field, type and location like every other number.
- "Checked" shows exact time and date rather than "3 hrs ago" — a panel that hasn't refreshed in hours should be obvious, not vague.
- Range control (Today / 7 days / All). The panel was only ever showing jobs first seen today, so a tracker repo with 3,000 live listings looked like 253 — everything older was stored but invisible.
- The list is capped at 200 rows while the count reflects every match, and the panel says "Showing 200 of 5,759" rather than quietly truncating.
- An unrecognised range falls back to Today instead of erroring: a bad query string shouldn't empty the panel.
- Search bar under the filters, matching company, role and location. Runs on the server, before the 200-row cap — a browser-side search would silently miss every match past row 200.
- Every term must appear, so "stripe intern" narrows rather than widens. Substring rather than whole-word, since searching is exploratory and "eng" should find "Engineering".
- Debounced 250ms: one request per pause in typing, not one per keystroke. The empty state names the query that found nothing.
- Education filter (Bachelor's / Master's / PhD / Not stated), read from job descriptions. Greenhouse returns every job's full body in the same request with `?content=true`, so this costs one extra query parameter rather than one request per job.
- Every level mentioned is recorded, not just the highest: "Bachelor's required, Master's preferred" is open to both.
- Abbreviations need word boundaries — bare "ms" appears inside "systems" and "ba" inside "database". Caught by a test.
- Patterns widened to what postings actually write: B.A./B.S./BSc, B.Tech, BEng, baccalaureate, undergraduate, MBA, M.Tech, postgraduate, D.Phil, and BS/MS-style pairs.
- "MS" is also Microsoft: "MS Office", "MS Excel", "MS SQL" appear in a large share of postings and each read as a master's requirement. Product names are stripped before the abbreviation check.
- "MA" removed as a code entirely — it's the state in "Boston, MA", which appears constantly and means nothing about a degree.
- Real bug found while reading the code: the regex cache was a plain map written lazily, and `Save` runs a goroutine per company. Concurrent map writes crash Go rather than merely racing. Now compiled once at package start.
- `cmd/reclassify` re-derives education and term from stored descriptions, since a stored verdict doesn't change when the classifier improves. First run: 187 descriptions re-read, 24 verdicts corrected.
- "Not stated" is a real option rather than a silent pass. Only 127 of 615 Stripe postings mention a degree at all, so treating silence as "matches everything" would have made the filter useless.
- Term filter (Spring/Summer/Fall/Winter by year), read from the title first and the description only as a fallback — descriptions mention other intakes in passing too often to trust.
- The term list is three fixed intakes (Fall 2026, Spring 2027, Summer 2027), not a rolling window. A generated list produced Fall 2027 and Winter 2027 buckets holding the same postings as Summer and Spring 2027 — job text mentions future terms in passing far more often than it advertises them.
- Winter is folded into spring: in North American hiring they're one intake, and keeping them apart gave two buckets of the same listings.
- Migration 012 brings existing rows into line. The first attempt only cleared rows matching *no* tracked term, leaving untracked ones inside combined values like "summer_2027,fall_2027" — those need stripping element by element.
- Season and year must appear within 20 characters of each other; further apart is usually two unrelated facts in one sentence.
- Tracker jobs now get real descriptions. Their links point at an ATS — Ashby 318, Greenhouse 302, Lever 119, SmartRecruiters 105 of a 4,000 sample — so `internal/jobsource` reads the provider and job id out of the URL and calls that provider's API instead of scraping a rendered page.
- Fetched per board, not per job: Ashby and Lever only offer a board endpoint anyway, and for the others it turns dozens of requests into one.
- 150 jobs per run, so the backlog drains over a few cycles rather than firing a thousand requests at once.
- The pending query filters to fetchable hosts in SQL. Without it the newest 150 rows were mostly bespoke career sites, so each run burned its slice on the same unfetchable jobs and never reached the ones it could do something with — yield went from 22/150 to 134/150.
- Roughly 80% of tracker links are bespoke corporate sites (Tesla, TikTok, Oracle, Workday). Those stay without descriptions; scraping them is the fragile path this deliberately avoids.
- Both columns derive at save time, not per request: descriptions are kilobytes each and re-parsing thousands on every panel load would be far too slow. Both have backfills, since `DO NOTHING` skips existing rows.

- Sponsorship filter, read from descriptions. Four verdicts rather than three: "unclear" means the posting discussed sponsorship but not in a way a keyword could settle, which is different from never mentioning it. Those 32 are the ones worth sending to Claude later.
- "Sponsor" alone means nothing — postings advertise "company sponsored conferences" and "sponsored hackathons". A match only counts near immigration words.
- Refusals are checked before offers: a posting that sponsors for senior roles but not this one is refusing for this one. Covered by a test.
- The context regex first required exactly "visa" and missed "visas", so a plain refusal read as not-stated. Caught by a test, not by reading it.
- Verified on real data: 34 explicit refusals, 14 offering, 32 unclear, 523 silent. Filtering to refusals returns exactly 34.

### Found (monitoring itself)
- The 30-minute loop had not fired in 282 minutes despite 4h44m uptime. `time.Ticker` doesn't fire while the machine sleeps, and delivers one tick on wake rather than the nine it missed. Not fixable locally in any real sense — monitoring needs a host, which is deferred.
- `datadogs` is not a Greenhouse board (`datadog` is). It returns nothing and fails silently on every run; nothing in the UI says a configured board is dead.
- Greenhouse publishes no directory of its customers, so a board name can only be validated by fetching it. Worth doing when one is added.

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

**E — Sponsorship filter**
- [x] Fetch the full description per posting — done via `?content=true` and `internal/jobsource`
- [x] Keyword pre-pass: refusals and offers both use standard phrasing
- [x] Four verdicts: sponsors, will not, unclear, not stated
- [x] Cached per job — a description doesn't change, so it's classified once
- [ ] Claude reads the "unclear" ones — 32 of them, blocked on credits
- [x] "Not stated" is the large majority, as expected: 523 of 603

### Tested

### Found

### Fixed

---

## 6. Resume scoring

Status: not started
