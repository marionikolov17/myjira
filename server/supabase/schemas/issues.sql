create type issue_status as enum ('To-Do', 'In Progress', 'Done');
create type issue_priority as enum ('Low', 'Medium', 'High');

create table issues (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text not null,
    status issue_status not null,
    priority issue_priority not null,
    creator_id uuid not null references users(id),
    project_id uuid not null references projects(id),
    assignee_id uuid not null references users(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index idx_issues_project_id on issues(project_id);
create index idx_issues_assignee_id on issues(assignee_id);
create index idx_issues_status on issues(status);
create index idx_issues_priority on issues(priority);
