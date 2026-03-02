create table projects (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text not null,
    creator_id uuid not null references users(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index idx_projects_creator_id on projects(creator_id);