-- Stored facts about the user, used to fill the "profile" fields on an
-- application form (name, email, phone, LinkedIn, ...).
--
-- Key-value rather than fixed columns: adding a new fact later is an INSERT,
-- not a migration. Keys match the PROFILE_PATTERNS keys in the extension.
create table profile (
    id uuid PRIMARY KEY default gen_random_uuid(),
    key TEXT not null unique,
    value TEXT not null,
    updated_at TIMESTAMPTZ not null default now()
);
