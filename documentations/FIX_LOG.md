# Fix Log

Bugs found and fixed, in order. Each entry: what broke, why, what we did about it, how we know it's fixed.

Different from `BUILD_LOG.md` — that records what got **built**, this records what got **broken and repaired**.

Template for new entries:

```
### [date] — [short name]
- **Issue:** what was visibly wrong
- **Cause:** why it happened
- **Fix:** what we decided to do
- **Done:** what actually changed in code
- **Verified:** how we proved it works
```

---

### 2026-08-22 — Slack pinged once per job

- **Issue:** 70 new jobs meant 70 separate Slack messages. Unreadable.
- **Cause:** `SendSlackMessage` was called inside the per-job loop.
- **Fix:** collect new jobs during the run, send one summary at the end.
- **Done:** `SaveGreenhouseJobs` returns the new jobs instead of notifying; `NotifyNewJobs` builds a single message with a count, timestamp, and numbered list.
- **Verified:** live run — one grouped message instead of many.

---

### 2026-08-22 — Duplicates re-notified every run

- **Issue:** the same job would ping Slack again on the next 30-minute cycle.
- **Cause:** `InsertJob` returned only an error, so a real insert and a silently-skipped duplicate looked identical to the caller.
- **Fix:** report whether a row was actually written.
- **Done:** `InsertJob` returns `(bool, error)` using `tag.RowsAffected() > 0`; only `true` results reach Slack.
- **Verified:** second identical run left the row count unchanged and sent nothing.

---

### 2026-08-22 — Keyword "intern" matched "Internal Audit"

- **Issue:** searching for internships returned 6 Internal Audit jobs at Coinbase. None were internships.
- **Cause:** `strings.Contains` matches substrings anywhere — "intern" sits inside "internal".
- **Fix:** match whole words only.
- **Done:** switched to `regexp` with `\b` word boundaries and `(?i)` for case-insensitivity; `regexp.QuoteMeta` escapes the keyword in case it ever contains regex characters.
- **Verified:** same Coinbase search went from 6 false matches to 0 real ones — correct, since Coinbase had no actual internships posted.

---

### 2026-08-24 — Stray character broke the build

- **Issue:** backend stopped compiling — `invalid character U+20B9 '₹' in identifier`.
- **Cause:** a `₹` was accidentally typed at the end of `monitor.go`.
- **Fix:** delete it.
- **Done:** removed the character.
- **Verified:** `go build` passed again.

---

### 2026-08-25 — CI couldn't cache Go dependencies

- **Issue:** CI warned `Dependencies file is not found... Supported file pattern: go.sum`.
- **Cause:** the cache action looked for `go.sum` at the repo root, but this is a monorepo — it lives in `backend/`.
- **Fix:** tell the action where to actually look.
- **Done:** added `cache-dependency-path: backend/go.sum`.
- **Verified:** warning gone; backend job dropped from ~21s to ~5s.

---

### 2026-08-26 — Extension button did nothing (CORS)

- **Issue:** clicking "Monitor this repo" on GitHub silently failed. Console: `blocked by CORS policy: No 'Access-Control-Allow-Origin' header`.
- **Cause:** browsers block a page on one site (`github.com`) from calling a server on another (`localhost:8080`) unless the server explicitly permits it. Our Go server said nothing, so the browser blocked it.
- **Fix:** have the backend declare that cross-origin calls are allowed.
- **Done:** `withCORS` middleware sets the `Access-Control-Allow-*` headers and answers the browser's automatic `OPTIONS` "preflight" request directly instead of passing it to the handler.
- **Verified:** preflight returns `200` with the right headers; button worked, row landed in `monitored_repos`.
- **Still open:** `Allow-Origin: *` lets any site call this endpoint. Fine for local dev, should be narrowed before this is ever public.

---

### 2026-08-26 — URL text injected into page markup

- **Issue:** no visible symptom — caught during a security review of code we'd just written.
- **Cause:** `owner` and `repo` come from the page URL (untrusted) and were interpolated straight into `innerHTML`. Same class of bug as SQL injection: input treated as code rather than data.
- **Fix:** never let untrusted text become markup.
- **Done:** the panel's HTML now has empty placeholder spans; `owner`/`repo` are written with `textContent`, which can't create elements.
- **Verified:** panel still renders correctly; the injection path no longer exists.
- **Note:** browsers percent-encode most dangerous characters in URLs, so this was hard to exploit in practice — but relying on that as the defense is fragile.

---

### 2026-08-26 — Panel re-prompted on repos already being watched

- **Issue:** the "Monitor this repo?" panel appeared every visit, even for repos already added.
- **Cause:** the extension could only write (`POST /repos`) — it had no way to ask what was already monitored.
- **Fix:** check with the backend before showing anything, and show a passive badge instead when already watched.
- **Done:** added `GET /repos` (reusing the existing `db.GetMonitoredRepos`); the extension calls `isMonitored()` first and mounts either a fading "Monitoring" badge or the full panel.
- **Verified:** monitored repo → badge, new repo → panel, backend down → panel.
- **Key decision:** the check **fails open** — if the backend is unreachable it shows the panel. Re-adding a repo is harmless (`ON CONFLICT DO NOTHING`), but wrongly hiding the panel would leave the user thinking a repo is watched when nothing is watching it.

---

### 2026-08-26 — Empty repo list would have returned `null`, not `[]`

- **Issue:** caught before it shipped, not observed in the wild.
- **Cause:** Go encodes a nil slice as JSON `null`. With zero repos in the database, `GET /repos` would return `null`, and the extension's `Array.isArray()` check would fail.
- **Fix:** always send an array, even when empty.
- **Done:** `listReposHandler` substitutes `[]string{}` when the query returns nil.
- **Verified:** endpoint returns a JSON array.
- **Why it mattered:** combined with fail-open, the failure would have been silent — the panel would just keep appearing forever with no error anywhere.

---

### 2026-08-26 — Repo saved as "Monitoring" but produced zero jobs, forever

- **Issue:** added `speedyapply/2027-SWE-College-Jobs`, got a "Monitoring" confirmation and a database row. It would never have returned a single job.
- **Cause:** the extension *guessed* the feed URL (`dev/.github/scripts/listings.json`) and nothing checked the guess. That repo uses branch `main`, not `dev` — and publishes markdown tables, not JSON, so it had no `listings.json` anywhere.
- **Why it was bad:** not just wrong, but wrong *invisibly while reporting success*. The monitor would 404 every 30 minutes into a log nobody reads.
- **Fix:** stop guessing on the client; resolve and validate on the backend before saving. Also teach the fetcher to read markdown, since plenty of real trackers publish that way.
- **Done:**
  - `ParseMarkdownListings` reads markdown job tables into the same `Listing` type the JSON feed produces, so nothing downstream changes.
  - `FetchListings` picks a parser by file extension, and now treats a non-200 response as an error — previously a 404 HTML page decoded to zero listings and looked like "no jobs today".
  - `ResolveFeedURL` tries known conventions in order and only accepts one that fetches **and** parses to at least one job.
  - `POST /repos` now takes `{owner, repo}` instead of a feed URL and returns **422** when no readable feed exists; the extension shows "No job feed found in this repo" rather than a false success.
- **Verified:** markdown repo → 201 and resolved to `main/README.md` (169 jobs); `facebook/react` → 422 rejected; all three stored feeds return 200; the bad row was deleted and re-added correctly.
- **Design note:** feed conventions are backend knowledge now. The extension sends repo identity only — it never constructs a raw.githubusercontent.com URL.
- **Known limit:** a repo with several markdown job files (USA vs international) only gets the first one that resolves.

---

### 2026-08-27 — Panel never appeared when clicking between repos

- **Issue:** pasting a repo URL showed the panel, but clicking through to a repo from GitHub's homepage showed nothing.
- **Cause:** GitHub is a single-page app — clicking a link swaps the content and rewrites the URL without ever loading a page. Content scripts only run on real page loads, so ours ran once and never again.
- **Fix:** watch the URL instead of relying only on page load.
- **Done:** `handleLocation()` re-runs on a short interval and on back/forward; it clears any leftover panel when the path changes, and discards a stale result if the user navigates again mid-check.
- **Verified:** syntax checked; behavior confirmed in-browser.

---

### 2026-08-27 — Panel prompted on every repo, not just job trackers

- **Issue:** the "Monitor this repo?" panel appeared on any GitHub repo — `facebook/react`, `torvalds/linux`, anything.
- **Cause:** nothing checked whether a repo actually publishes job listings until you clicked. The panel was optimistic by default.
- **Why it couldn't just call the resolver:** resolution costs several fetches, and markdown feeds mean downloading a whole README. Doing that on every repo page you browse would be slow and would hammer GitHub. Checking file *existence* doesn't help either — nearly every repo has a `README.md`, so only parsing its contents can tell you if it holds job tables.
- **Fix:** resolve once per repo, cache the answer — including "no feed", which is the case that actually needs to be cheap.
- **Done:**
  - `repo_checks` table (migration 004), unique on `(owner, repo)`; `feed_url IS NULL` means "checked, not a job repo".
  - `GET /repos/check?owner=&repo=` returns `{monitorable, monitored}`; `POST /repos` reuses the same cache so clicking doesn't re-resolve.
  - Extension calls it before rendering and shows nothing at all when `monitorable` is false.
- **Verified:** job repo + monitored → `{true,true}` (badge); job repo unmonitored → `{true,false}` (panel); `facebook/react` and `torvalds/linux` → `{false,false}` (nothing).
- **Measured (corrected):** cache hit is a steady ~0.09s; a miss runs 0.18–0.43s and varies with network. So roughly **2–5x faster, and far more consistent** — an earlier note claiming 1.10s → 0.09s was a cold-start outlier, not the typical case.
- **Design note:** the two flags fail in opposite directions on purpose. `monitorable` defaults false so an unreachable backend means silence rather than prompting on every repo; `monitored` defaults false because re-showing the panel is harmless while wrongly hiding it is not.
- ~~**Known limit:** the cache never expires~~ — fixed below.

---

### 2026-08-27 — Cached "not a job repo" answers never expired

- **Issue:** once a repo was checked, that answer was kept forever. A repo that added a job feed later would stay marked "not a tracker" permanently.
- **Cause:** the cache lookup matched on `owner`/`repo` only, with no age condition — any row, however old, counted as a valid answer.
- **Fix:** treat rows older than 7 days as if they don't exist.
- **Done:** one line of SQL in `GetRepoCheck` — added `AND checked_at > now() - interval '7days'`. No Go changes: a stale row simply returns no rows, which is already the "never checked" path, so it re-resolves and overwrites via the existing upsert.
- **Verified:** aged a row 30 days artificially, re-requested it, and confirmed `checked_at` jumped from 04:07 → 04:23 — proof the stale row was ignored and refreshed rather than reused.
- **Gotcha hit while writing it:** `now` without parentheses fails with `column "now" does not exist` — Postgres reads it as a column name, not a function call. (`interval '7days'` without a space is fine, though — Postgres accepts it.)

---

### 2026-08-31 — Visa question misread as a location field

- **Issue:** "Will you now or in the future require sponsorship for a visa to remain in your current location?" was classified as a `location` profile field — meaning autofill would have typed the user's city into a yes/no legal question.
- **Cause:** profile matching used substring search, and the word "location" appears inside that long question. Same bug shape as "intern" matching "Internal Audit" back in Phase 2.
- **Fix:** treat any label over 40 characters as a question before pattern matching runs. Real profile fields are short ("Email", "Phone", "LinkedIn Profile"); long text is always a question.
- **Done:** length guard added in `classifyField`, placed *before* the pattern loop — order matters, since after the loop it would never be reached.
- **Verified:** that question and two other country-phrased ones now classify as `question`; short fields still match correctly.
- **Also:** `scanFields` now skips `search`/`submit`/`button` inputs — a phone-widget search box was being scanned as a real field.

---

### 2026-09-02 — Autofill worked on one job board, silently did nothing on others

- **Issue:** autofill filled a GitLab application fine, but on Stripe's it logged `filled 0 fields` with no visible error.
- **Cause:** three separate problems stacked, each hiding the next.
  1. The manifest only matched `*.greenhouse.io`. Stripe hosts the same form on its own domain, so the script never ran.
  2. The form lives in an embedded frame. `document.querySelectorAll` only sees the current document, so even when the script ran it found zero fields.
  3. Chrome blocks a public site from calling `localhost` (Private Network Access). The fetch failed, the profile came back empty, and every field was skipped for having no value.
- **Fix:**
  1. Match all sites and let `isApplicationPage()` decide — it already returns false on non-application pages.
  2. `"all_frames": true`, so the script runs inside embedded frames too.
  3. Move the fetch into a **background service worker**. It runs under the extension's own origin with declared `host_permissions`, so the loopback restriction doesn't apply; the content script asks it via `chrome.runtime.sendMessage`.
- **Tried and rejected:** the server-side opt-in header `Access-Control-Allow-Private-Network: true`. Verified it was sent correctly, and Chrome still blocked the request — that opt-in no longer lifts the restriction for content scripts. The service worker is the supported route.
- **Verified:** live on Stripe's application — profile fields fill, no CORS error.
- **Debugging note worth keeping:** an early `64 inputs` reading contradicted a later `0`. Cause was DevTools' console frame selector pointing at a different frame — on a page with iframes, always confirm that dropdown says `top` before trusting a DOM measurement.

---

### 2026-09-02 — AI service hung on startup, never bound its port

- **Issue:** `uvicorn main:app` sat there for ten minutes without printing a line or answering `/health`. No error, no crash — the process was alive the whole time.
- **Cause:** the venv lived in iCloud Drive. Every package file read round-trips through the sync daemon. Measured: the same 20 `anthropic` source files took **17.0s** cold and **0.02s** warm, at ~0.01s of CPU — pure I/O blocking. `anthropic` is hundreds of files, so the import alone ran into minutes.
- **Telltale:** the process had 1.3s of CPU after ten minutes of wall clock. Near-zero CPU on a "hung" process means it is waiting on I/O, not looping.
- **Fix:** venv moved out of iCloud to `~/.venvs/gojobs` (local disk). Source stays in iCloud — it's small and worth syncing; the 10k-file dependency tree is neither.
- **Done:** rebuilt with `/opt/homebrew/bin/python3.13` — the first attempt used `/usr/bin/python3`, which is 3.9, and `pip` rejected the pinned versions. Match the interpreter the project was built with.
- **Verified:** `import anthropic` now 2.9s cold; server boots in ~10s and `/health` returns 200.

---

### 2026-09-02 — Every Claude endpoint came up without an API key

- **Issue:** `/route` returned 500 with `Could not resolve authentication method`, though `ANTHROPIC_API_KEY` was present in `.env`.
- **Cause:** `load_dotenv()` ran *after* the local imports in `main.py`. Each of `tailor`, `cover_letter`, `answer`, `route_question` builds `anthropic.Anthropic()` at module level, and the client reads the env var at construction — so all four were built keyless before the `.env` was ever loaded.
- **Fix:** moved `load_dotenv()` above the local imports, with a comment saying why the order matters.
- **Done:** import order is load-bearing here; a formatter that sorts imports to the top would silently reintroduce this.
- **Verified:** the key now resolves — Anthropic returns a billing `400` instead of an auth `TypeError`, which is the correct failure for an account with no credits.
- **Scope:** this was breaking `/answer`, `/tailor-resume` and `/cover-letter` too, not just the new endpoint.
