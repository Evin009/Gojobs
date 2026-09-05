-- App settings the user controls: Slack webhook and toggle, the Greenhouse
-- companies to poll, the role categories to keep.
--
-- Key-value like `profile`, for the same reason: adding a setting later is an
-- INSERT, not a migration. Values are TEXT; the caller parses booleans and
-- comma-separated lists.
create table settings (
    id uuid PRIMARY KEY default gen_random_uuid(),
    key TEXT not null unique,
    value TEXT not null,
    updated_at TIMESTAMPTZ not null default now()
);

-- Defaults, so a fresh install monitors something rather than nothing.
-- Slack starts off: notifications are opt-in, and there's no webhook yet.
insert into settings (key, value) values
    ('slack_enabled', 'false'),
    ('slack_webhook', ''),
    ('companies', 'databricks,robinhood,cloudflare'),
    ('roles', 'swe')
on conflict (key) do nothing;
