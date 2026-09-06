-- Education levels a job description mentions, comma-separated
-- ("bachelors,masters") or "not_stated".
--
-- Derived once at save time rather than parsed per request: descriptions are
-- kilobytes each and scanning thousands of them on every panel load would be
-- far too slow.
alter table jobs add column if not exists education TEXT not null default '';
