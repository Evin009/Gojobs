-- Which intake a posting is for: "summer_2027", or "not_stated".
-- Derived at save time for the same reason education is.
alter table jobs add column if not exists term TEXT not null default '';
