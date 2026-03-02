create type workspace_role_name as enum ('Owner', 'Admin', 'Developer');

create table workspace_roles (
    id uuid primary key default gen_random_uuid(),
    name workspace_role_name not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);
