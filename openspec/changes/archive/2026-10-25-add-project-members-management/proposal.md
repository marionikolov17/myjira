## Why

The server has a projects header domain and bootstraps a Project Owner at creation, but there is no way to grow a project team afterwards: no endpoint to add other members, change their project roles, remove them, or list who belongs to the project. The functional requirements name project members as the gate for all project-scoped work ("only project members can access a project and its issues and subtasks"), and the API design document enumerates four project-member endpoints that nothing today implements. Shipping this capability unblocks every issue and subtask feature downstream and establishes the first project-scoped write surface beyond the project header itself.

## What Changes

- Add a `project-members` HTTP surface mounted under `/api/v1/projects/:projectId/members`:
  - `POST   /`              — add a user to the project with a non-owner project role.
  - `GET    /`              — list all project members of the project (full set, no pagination).
  - `PATCH  /:memberId`     — change a member's project role between Project Admin and Developer.
  - `DELETE /:memberId`     — remove a member from the project.
- Introduce three new authorization actions — `removeProjectMember`, `listProjectMembers`, and `updateProjectMemberRole` (the last **replaces** the pre-existing `updateProjectRole` entry) — and tighten/extend the two existing project-member actions in the matrix:
  - `addProjectMember`: narrow to `{ projectRoles: [PROJECT_OWNER, PROJECT_ADMIN], workspaceBypass: [WORKSPACE_OWNER] }`.
  - `updateProjectMemberRole` (renamed from `updateProjectRole`): narrow to `{ projectRoles: [PROJECT_OWNER], workspaceBypass: [WORKSPACE_OWNER] }`.
  - `removeProjectMember`: `{ projectRoles: [PROJECT_OWNER, PROJECT_ADMIN], workspaceBypass: [WORKSPACE_OWNER] }`.
  - `listProjectMembers`: `{ projectRoles: [PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER], workspaceBypass: [WORKSPACE_OWNER, WORKSPACE_ADMIN] }`.
- Enforce a "target-role ladder" business rule in the service for add/remove: a `PROJECT_ADMIN` actor may only add or remove members whose target project role is `Developer`; attempts to touch a Project Admin or Project Owner target yield 422. Workspace Owner bypass actors act as effective Project Owner and are not subject to the ladder.
- Enforce "the Project Owner member cannot be removed" (422) and "no actor may mutate (PATCH/DELETE) their own project-member row" (422) as named business rules.
- Carry the target role via an opaque `projectRoleId: UUID` field in both POST and PATCH, mirroring the existing `UpdateUserRoleRequestParamsSchema` convention. The service resolves the id and rejects (422) when it does not resolve to any project role, or when it resolves to the Project Owner role (which is never assignable through these endpoints).
- Scaffold the full module under `server/src/modules/project-members/`: add `project-member.service.ts`, `project-member.controller.ts`, `project-member.types.ts`, extend `project-member.interface.ts` and `project-member.repository.ts` with the methods the four endpoints need, and wire DI in `index.ts`. No `project-member.query-config.ts` file (always-full-set list; dead placeholder deliberately avoided).
- Introduce a new `server/src/modules/project-roles/` module that mirrors `workspace-roles/`: owns the `ProjectRoleName` enum (moved from `project-members`), `ProjectRoleSchema`, `IProjectRoleRepository`, and the Prisma-backed `ProjectRoleRepository` exposing `getProjectRoles`, `getProjectRoleById`, and `getProjectRoleIdByName`. Existing callsites that import `ProjectRoleName` from `@/modules/project-members` are migrated to `@/modules/project-roles`. The pre-existing `getProjectRoleIdByName` method is moved out of `project-member.repository.ts` into the new module (its only caller — `ProjectService.createProject`'s Owner bootstrap — switches to the new injected `projectRoleRepository`). This is a pre-existing asymmetry (workspace roles already live in their own module; project roles did not) that this change takes the opportunity to resolve.
- Mount `project-member.controller.router` in `server/src/app.ts` at `/api/v1/projects/:projectId/members` using `Router({ mergeParams: true })` so the router sees `req.params.projectId`. The projects module remains unaware.
- List and single-resource response payloads expand both relations (`user: { id, name, email }` and `projectRole: { id, name }`); the "project member resource" shape is defined once and reused across all four endpoints.

## Capabilities

### New Capabilities

- `project-members`: Project-scoped lifecycle of a project member — adding a non-owner user to a project, listing all project members, changing a member's project role between Project Admin and Developer, and removing a non-owner member. Owns the target-role ladder, the "owner cannot be removed," and the "no self-mutation" business rules, the expanded response shape, and the four actions' project-scope authorization matrix entries (declared here, implemented by the authorization capability).

### Modified Capabilities

None. The matrix additions, rename, and narrowing above live entirely in `authorization-matrix.ts` and `authorization.types.ts` (code), not in `authorization/spec.md` (which describes the capability's concepts). This change introduces no new authorization concept — it reuses `workspaceBypass` as-is.

## Impact

- **New code**: `server/src/modules/project-members/project-member.service.ts`, `project-member.controller.ts`, `project-member.types.ts`; extensions to `project-member.interface.ts` and `project-member.repository.ts`; expanded `project-member.schema.ts` request/response schemas; DI wiring in `project-members/index.ts`. New module `server/src/modules/project-roles/` with `project-role.schema.ts`, `project-role.interface.ts`, `project-role.repository.ts`, `index.ts`.
- **Modified code**: `server/src/common/authorization/authorization.types.ts` (rename `updateProjectRole` -> `updateProjectMemberRole`; add `removeProjectMember`, `listProjectMembers`); `server/src/common/authorization/authorization-matrix.ts` (four entries per the delta above; `ProjectRoleName` import source changes to `@/modules/project-roles`); `server/src/app.ts` (mount `/api/v1/projects/:projectId/members`); `server/src/modules/projects/project.service.ts` and `project-members/index.ts` to switch the Owner bootstrap caller from `projectMemberRepository.getProjectRoleIdByName` to `projectRoleRepository.getProjectRoleIdByName` (one injected dep, one callsite); `project-member.schema.ts` to re-import `ProjectRoleName` from `@/modules/project-roles` instead of declaring it; `project-member.repository.ts` to drop `getProjectRoleIdByName`; any tests that import `ProjectRoleName` from `@/modules/project-members`.
- **Database**: None. The `project_members.(project_id, user_id)` unique index and the `onDelete: Cascade` on `project_members.project_id` already satisfy the uniqueness/409 and project-delete-cascade requirements of this change.
- **API**: Four new public endpoints under `/api/v1/projects/:projectId/members`; no existing endpoints change behavior. The pre-existing project-member bootstrap on `POST /projects` is unaffected.
- **Tests**: Unit tests for the new service branches (ladder, self-mutation, owner-removal protection, target lookup for DELETE) and extended guard entries; integration tests for the four endpoints following the existing fixtures/assertions co-location pattern.
- **Out of scope**: Project Owner transfer, batch member add/remove, a "my memberships" list across projects, free-text search over members, pagination/sorting/filtering on the member list, soft-delete, and promoting the target-role ladder to a declarative matrix concept.
