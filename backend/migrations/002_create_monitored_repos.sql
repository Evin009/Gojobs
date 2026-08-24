create table monitored_repos (
    id uuid Primary KEY default gen_random_uuid(),
    url TEXT unique not null ,
    added_at TIMESTAMPTZ not null  default now()
);