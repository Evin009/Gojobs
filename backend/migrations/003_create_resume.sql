create table resumes (
    id uuid PRIMARY KEY default gen_random_uuid(),
    content TEXT not null,
    job_id uuid REFERENCES jobs(id),
    created_at TIMESTAMPTZ not null  default now()

);