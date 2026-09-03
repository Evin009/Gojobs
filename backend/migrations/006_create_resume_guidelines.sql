-- The rubric a resume is scored against, one row per guideline.
--
-- Rows rather than a prompt string: guidelines change often, and a score has
-- to name which ones failed so the rewrite can fix those specifically.
create table resume_guidelines (
    id uuid PRIMARY KEY default gen_random_uuid(),
    category TEXT not null,
    guideline TEXT not null unique,
    weight INT not null default 1,
    active BOOLEAN not null default true,
    created_at TIMESTAMPTZ not null default now()
);

-- Scores are kept per (resume, job) so a decision to rewrite — or not — is
-- reviewable later. failed_ids holds the guidelines that didn't pass.
create table resume_scores (
    id uuid PRIMARY KEY default gen_random_uuid(),
    resume_id uuid not null references resumes(id),
    job_id uuid references jobs(id),
    score INT not null,
    failed_ids uuid[] not null default '{}',
    scored_at TIMESTAMPTZ not null default now()
);

create index on resume_scores (resume_id);
