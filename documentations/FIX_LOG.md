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
