create type "public"."issue_priority" as enum ('Low', 'Medium', 'High');

create type "public"."issue_status" as enum ('To-Do', 'In Progress', 'Done');

create type "public"."project_role_name" as enum ('Project Owner', 'Project Admin', 'Developer');

create type "public"."workspace_role_name" as enum ('Owner', 'Admin', 'Developer');


  create table "public"."issues" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text not null,
    "status" public.issue_status not null,
    "priority" public.issue_priority not null,
    "creator_id" uuid not null,
    "project_id" uuid not null,
    "assignee_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."project_members" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "user_id" uuid not null,
    "project_role_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."project_roles" (
    "id" uuid not null default gen_random_uuid(),
    "name" public.project_role_name not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."projects" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text not null,
    "creator_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."subtasks" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text not null,
    "status" public.issue_status not null,
    "creator_id" uuid not null,
    "issue_id" uuid not null,
    "assignee_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."users" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "email" text not null,
    "password" text not null,
    "workspace_role_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."workspace_roles" (
    "id" uuid not null default gen_random_uuid(),
    "name" public.workspace_role_name not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


CREATE INDEX idx_issues_assignee_id ON public.issues USING btree (assignee_id);

CREATE INDEX idx_issues_priority ON public.issues USING btree (priority);

CREATE INDEX idx_issues_project_id ON public.issues USING btree (project_id);

CREATE INDEX idx_issues_status ON public.issues USING btree (status);

CREATE INDEX idx_project_members_project_id ON public.project_members USING btree (project_id);

CREATE INDEX idx_project_members_project_role_id ON public.project_members USING btree (project_role_id);

CREATE UNIQUE INDEX idx_project_members_project_user ON public.project_members USING btree (project_id, user_id);

CREATE INDEX idx_project_members_user_id ON public.project_members USING btree (user_id);

CREATE INDEX idx_projects_creator_id ON public.projects USING btree (creator_id);

CREATE INDEX idx_subtasks_assignee_id ON public.subtasks USING btree (assignee_id);

CREATE INDEX idx_subtasks_issue_id ON public.subtasks USING btree (issue_id);

CREATE INDEX idx_users_workspace_role_id ON public.users USING btree (workspace_role_id);

CREATE UNIQUE INDEX issues_pkey ON public.issues USING btree (id);

CREATE UNIQUE INDEX project_members_pkey ON public.project_members USING btree (id);

CREATE UNIQUE INDEX project_roles_pkey ON public.project_roles USING btree (id);

CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id);

CREATE UNIQUE INDEX subtasks_pkey ON public.subtasks USING btree (id);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX workspace_roles_pkey ON public.workspace_roles USING btree (id);

alter table "public"."issues" add constraint "issues_pkey" PRIMARY KEY using index "issues_pkey";

alter table "public"."project_members" add constraint "project_members_pkey" PRIMARY KEY using index "project_members_pkey";

alter table "public"."project_roles" add constraint "project_roles_pkey" PRIMARY KEY using index "project_roles_pkey";

alter table "public"."projects" add constraint "projects_pkey" PRIMARY KEY using index "projects_pkey";

alter table "public"."subtasks" add constraint "subtasks_pkey" PRIMARY KEY using index "subtasks_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."workspace_roles" add constraint "workspace_roles_pkey" PRIMARY KEY using index "workspace_roles_pkey";

alter table "public"."issues" add constraint "issues_assignee_id_fkey" FOREIGN KEY (assignee_id) REFERENCES public.users(id) not valid;

alter table "public"."issues" validate constraint "issues_assignee_id_fkey";

alter table "public"."issues" add constraint "issues_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public.users(id) not valid;

alter table "public"."issues" validate constraint "issues_creator_id_fkey";

alter table "public"."issues" add constraint "issues_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) not valid;

alter table "public"."issues" validate constraint "issues_project_id_fkey";

alter table "public"."project_members" add constraint "project_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) not valid;

alter table "public"."project_members" validate constraint "project_members_project_id_fkey";

alter table "public"."project_members" add constraint "project_members_project_role_id_fkey" FOREIGN KEY (project_role_id) REFERENCES public.project_roles(id) not valid;

alter table "public"."project_members" validate constraint "project_members_project_role_id_fkey";

alter table "public"."project_members" add constraint "project_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) not valid;

alter table "public"."project_members" validate constraint "project_members_user_id_fkey";

alter table "public"."projects" add constraint "projects_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public.users(id) not valid;

alter table "public"."projects" validate constraint "projects_creator_id_fkey";

alter table "public"."subtasks" add constraint "subtasks_assignee_id_fkey" FOREIGN KEY (assignee_id) REFERENCES public.users(id) not valid;

alter table "public"."subtasks" validate constraint "subtasks_assignee_id_fkey";

alter table "public"."subtasks" add constraint "subtasks_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public.users(id) not valid;

alter table "public"."subtasks" validate constraint "subtasks_creator_id_fkey";

alter table "public"."subtasks" add constraint "subtasks_issue_id_fkey" FOREIGN KEY (issue_id) REFERENCES public.issues(id) not valid;

alter table "public"."subtasks" validate constraint "subtasks_issue_id_fkey";

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

alter table "public"."users" add constraint "users_workspace_role_id_fkey" FOREIGN KEY (workspace_role_id) REFERENCES public.workspace_roles(id) not valid;

alter table "public"."users" validate constraint "users_workspace_role_id_fkey";

grant delete on table "public"."issues" to "anon";

grant insert on table "public"."issues" to "anon";

grant references on table "public"."issues" to "anon";

grant select on table "public"."issues" to "anon";

grant trigger on table "public"."issues" to "anon";

grant truncate on table "public"."issues" to "anon";

grant update on table "public"."issues" to "anon";

grant delete on table "public"."issues" to "authenticated";

grant insert on table "public"."issues" to "authenticated";

grant references on table "public"."issues" to "authenticated";

grant select on table "public"."issues" to "authenticated";

grant trigger on table "public"."issues" to "authenticated";

grant truncate on table "public"."issues" to "authenticated";

grant update on table "public"."issues" to "authenticated";

grant delete on table "public"."issues" to "service_role";

grant insert on table "public"."issues" to "service_role";

grant references on table "public"."issues" to "service_role";

grant select on table "public"."issues" to "service_role";

grant trigger on table "public"."issues" to "service_role";

grant truncate on table "public"."issues" to "service_role";

grant update on table "public"."issues" to "service_role";

grant delete on table "public"."project_members" to "anon";

grant insert on table "public"."project_members" to "anon";

grant references on table "public"."project_members" to "anon";

grant select on table "public"."project_members" to "anon";

grant trigger on table "public"."project_members" to "anon";

grant truncate on table "public"."project_members" to "anon";

grant update on table "public"."project_members" to "anon";

grant delete on table "public"."project_members" to "authenticated";

grant insert on table "public"."project_members" to "authenticated";

grant references on table "public"."project_members" to "authenticated";

grant select on table "public"."project_members" to "authenticated";

grant trigger on table "public"."project_members" to "authenticated";

grant truncate on table "public"."project_members" to "authenticated";

grant update on table "public"."project_members" to "authenticated";

grant delete on table "public"."project_members" to "service_role";

grant insert on table "public"."project_members" to "service_role";

grant references on table "public"."project_members" to "service_role";

grant select on table "public"."project_members" to "service_role";

grant trigger on table "public"."project_members" to "service_role";

grant truncate on table "public"."project_members" to "service_role";

grant update on table "public"."project_members" to "service_role";

grant delete on table "public"."project_roles" to "anon";

grant insert on table "public"."project_roles" to "anon";

grant references on table "public"."project_roles" to "anon";

grant select on table "public"."project_roles" to "anon";

grant trigger on table "public"."project_roles" to "anon";

grant truncate on table "public"."project_roles" to "anon";

grant update on table "public"."project_roles" to "anon";

grant delete on table "public"."project_roles" to "authenticated";

grant insert on table "public"."project_roles" to "authenticated";

grant references on table "public"."project_roles" to "authenticated";

grant select on table "public"."project_roles" to "authenticated";

grant trigger on table "public"."project_roles" to "authenticated";

grant truncate on table "public"."project_roles" to "authenticated";

grant update on table "public"."project_roles" to "authenticated";

grant delete on table "public"."project_roles" to "service_role";

grant insert on table "public"."project_roles" to "service_role";

grant references on table "public"."project_roles" to "service_role";

grant select on table "public"."project_roles" to "service_role";

grant trigger on table "public"."project_roles" to "service_role";

grant truncate on table "public"."project_roles" to "service_role";

grant update on table "public"."project_roles" to "service_role";

grant delete on table "public"."projects" to "anon";

grant insert on table "public"."projects" to "anon";

grant references on table "public"."projects" to "anon";

grant select on table "public"."projects" to "anon";

grant trigger on table "public"."projects" to "anon";

grant truncate on table "public"."projects" to "anon";

grant update on table "public"."projects" to "anon";

grant delete on table "public"."projects" to "authenticated";

grant insert on table "public"."projects" to "authenticated";

grant references on table "public"."projects" to "authenticated";

grant select on table "public"."projects" to "authenticated";

grant trigger on table "public"."projects" to "authenticated";

grant truncate on table "public"."projects" to "authenticated";

grant update on table "public"."projects" to "authenticated";

grant delete on table "public"."projects" to "service_role";

grant insert on table "public"."projects" to "service_role";

grant references on table "public"."projects" to "service_role";

grant select on table "public"."projects" to "service_role";

grant trigger on table "public"."projects" to "service_role";

grant truncate on table "public"."projects" to "service_role";

grant update on table "public"."projects" to "service_role";

grant delete on table "public"."subtasks" to "anon";

grant insert on table "public"."subtasks" to "anon";

grant references on table "public"."subtasks" to "anon";

grant select on table "public"."subtasks" to "anon";

grant trigger on table "public"."subtasks" to "anon";

grant truncate on table "public"."subtasks" to "anon";

grant update on table "public"."subtasks" to "anon";

grant delete on table "public"."subtasks" to "authenticated";

grant insert on table "public"."subtasks" to "authenticated";

grant references on table "public"."subtasks" to "authenticated";

grant select on table "public"."subtasks" to "authenticated";

grant trigger on table "public"."subtasks" to "authenticated";

grant truncate on table "public"."subtasks" to "authenticated";

grant update on table "public"."subtasks" to "authenticated";

grant delete on table "public"."subtasks" to "service_role";

grant insert on table "public"."subtasks" to "service_role";

grant references on table "public"."subtasks" to "service_role";

grant select on table "public"."subtasks" to "service_role";

grant trigger on table "public"."subtasks" to "service_role";

grant truncate on table "public"."subtasks" to "service_role";

grant update on table "public"."subtasks" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

grant delete on table "public"."workspace_roles" to "anon";

grant insert on table "public"."workspace_roles" to "anon";

grant references on table "public"."workspace_roles" to "anon";

grant select on table "public"."workspace_roles" to "anon";

grant trigger on table "public"."workspace_roles" to "anon";

grant truncate on table "public"."workspace_roles" to "anon";

grant update on table "public"."workspace_roles" to "anon";

grant delete on table "public"."workspace_roles" to "authenticated";

grant insert on table "public"."workspace_roles" to "authenticated";

grant references on table "public"."workspace_roles" to "authenticated";

grant select on table "public"."workspace_roles" to "authenticated";

grant trigger on table "public"."workspace_roles" to "authenticated";

grant truncate on table "public"."workspace_roles" to "authenticated";

grant update on table "public"."workspace_roles" to "authenticated";

grant delete on table "public"."workspace_roles" to "service_role";

grant insert on table "public"."workspace_roles" to "service_role";

grant references on table "public"."workspace_roles" to "service_role";

grant select on table "public"."workspace_roles" to "service_role";

grant trigger on table "public"."workspace_roles" to "service_role";

grant truncate on table "public"."workspace_roles" to "service_role";

grant update on table "public"."workspace_roles" to "service_role";


