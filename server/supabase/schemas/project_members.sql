create table project_members (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id),
    user_id uuid not null references users(id),
    project_role_id uuid not null references project_roles(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create unique index idx_project_members_project_user on project_members(project_id, user_id);
create index idx_project_members_project_id on project_members(project_id);
create index idx_project_members_user_id on project_members(user_id);
create index idx_project_members_project_role_id on project_members(project_role_id);