create table subtasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text not null,
    status issue_status not null,
    creator_id uuid not null references users(id),
    issue_id uuid not null references issues(id),
    assignee_id uuid not null references users(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index idx_subtasks_issue_id on subtasks(issue_id);
create index idx_subtasks_assignee_id on subtasks(assignee_id);
