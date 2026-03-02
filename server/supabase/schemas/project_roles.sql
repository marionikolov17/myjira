create type project_role_name as enum ('Project Owner', 'Project Admin', 'Developer');

create table project_roles (
    id uuid primary key default gen_random_uuid(),
    name project_role_name not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);
