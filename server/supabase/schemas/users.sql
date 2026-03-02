create table users (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null unique,
    password text not null,
    workspace_role_id uuid not null references workspace_roles(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index idx_users_workspace_role_id on users(workspace_role_id);