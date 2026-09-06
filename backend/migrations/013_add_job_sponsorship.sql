-- Whether a posting says it will sponsor a work visa: "sponsors",
-- "no_sponsorship", "unclear", or "not_stated".
--
-- Derived from the description at save time, like education and term.
alter table jobs add column if not exists sponsorship TEXT not null default '';
