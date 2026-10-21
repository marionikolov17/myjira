## Why

The server has user management but no projects domain. The functional requirements name projects as the primary container for issues and subtasks, and the API design enumerates five header-level project endpoints that nothing today implements. Shipping the projects header unblocks every downstream capability (project members, issues, subtasks) and establishes the first project-scoped authorization surface on the server.

## What Changes

- Add a new `projects` module exposing header-level CRUD under `/api/v1/projects`:
  - `POST   /projects` — create a project.
  - `GET    /projects` — list projects with the shared pagination/sort/filter contract.
  - `GET    /projects/:id` — retrieve a project by id.
  - `PATCH  /projects/:id` — partially update `name` and/or `description` (at least one required).
  - `DELETE /projects/:id` — hard-delete a project.
- On project creation, atomically bootstrap the acting user as a `ProjectOwner` project member.
- Introduce three new authorization actions: `listProjects` (workspace scope) and `getProjectById`, `deleteProject` (project scope). `createProject` and `updateProject` already exist in the matrix.
- Extend the authorization capability with a declarative **`workspaceBypass`** concept so a workspace role can satisfy a project-scope action without requiring project membership. Applied to `getProjectById` (bypass: Workspace Owner, Workspace Admin), `updateProject` (bypass: Workspace Owner), and `deleteProject` (bypass: Workspace Owner). Workspace Admin is deliberately not in the write-bypass sets for this iteration; the asymmetry is easy to remove later by editing the matrix.
- Scope `GET /projects` results at the service layer: Workspace Owner / Admin see all projects; Developer sees only projects where they are a member.
- Introduce a reusable **`IUnitOfWork`** abstraction in `common/` so services can orchestrate multi-repository writes inside a single Prisma transaction without touching the Prisma client directly.
- Hard-delete semantics with database-level cascade for `project_members`, `issues`, and `subtasks` referencing a deleted project (and `subtasks` referencing a deleted issue). Requires a Prisma migration that adds `onDelete: Cascade` to the relevant foreign keys. Soft delete is explicitly deferred.
- Extend `project-members` repository with the minimum needed for bootstrap and role resolution (`createProjectMember`, `getProjectRoleIdByName`). No new `/project-members` endpoints.

## Capabilities

### New Capabilities

- `projects`: Header-level project lifecycle — creation (with Project Owner bootstrap), listing (actor-scoped), retrieval, partial update of `name`/`description`, and hard deletion with cascade. Declares the project-scope authorization matrix entries for its own actions and the workspace-scope entries for create/list.

### Modified Capabilities

- `authorization`: Introduce the `workspaceBypass` concept for project-scope decisions so a configured workspace role can authorize a project-scope action regardless of project membership; project-role-based authorization behavior otherwise unchanged.

## Impact

- **New code**: `server/src/modules/projects/` (controller, service, repository, schema, interface, types, query-config, DI index); `server/src/common/unit-of-work/` (interface + Prisma-backed implementation); extensions to `server/src/modules/project-members/project-member.repository.ts` and its interface.
- **Modified code**: `server/src/common/authorization/authorization.types.ts` (new actions + bypass-shape types), `server/src/common/authorization/authorization-matrix.ts` (three new entries + bypass fields), `server/src/common/authorization/authorization-guard.ts` (bypass evaluation), `server/src/app.ts` (mount `/api/v1/projects`).
- **Database**: Prisma migration adding `onDelete: Cascade` to foreign keys `project_members.project_id`, `issues.project_id`, and `subtasks.issue_id`.
- **API**: Five new public endpoints under `/api/v1/projects`; no existing endpoints change behavior.
- **Tests**: Unit tests for projects module, unit-of-work, and extended guard; integration tests for the five endpoints.
- **Out of scope**: project-members CRUD endpoints; issues and subtasks endpoints; soft delete; search over project name/description; the eventual promotion of `workspaceBypass` to a general predicate-based ABAC model.
