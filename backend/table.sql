create table jobs (
    id uuid  PRIMARY KEY default gen_random_uuid(),
    company TEXT not null ,
    role TEXT not null ,
    description TEXT not null ,
    url TEXT unique not null ,
    source TEXT not null ,
    created_at TIMESTAMPTZ not null  default now()


)