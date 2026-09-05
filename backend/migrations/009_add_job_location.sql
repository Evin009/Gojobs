-- Both sources already return a location and we were throwing it away.
-- Default '' rather than NULL: "we don't know" and "not stated" are the same
-- thing here, and one of them is easier to write queries against.
alter table jobs add column if not exists location TEXT not null default '';
