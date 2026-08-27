-- Caches "does this repo publish a job feed?" so the extension can ask on every
-- repo page without re-running the expensive resolution each time.
--
-- feed_url NULL means: we checked, and this repo has no readable job feed.
-- Caching that negative is the whole point — it's what stops the panel from
-- appearing on ordinary repos without paying for a lookup every page view.
create table repo_checks (
    id uuid PRIMARY KEY default gen_random_uuid(),
    owner TEXT not null,
    repo TEXT not null,
    feed_url TEXT,
    checked_at TIMESTAMPTZ not null default now(),
    unique (owner, repo)
);
