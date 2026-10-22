## 1. Authorization capability — matrix delta

- [ ] 1.1 Rename `updateProjectRole` to `updateProjectMemberRole` in `server/src/common/authorization/authorization.types.ts` and add new actions `removeProjectMember`, `listProjectMembers` to the `AuthorizationAction` union; verify by `npm run build` passing
- [ ] 1.2 In `server/src/common/authorization/authorization-matrix.ts`, replace the `updateProjectRole` entry with `updateProjectMemberRole: { projectRoles: [PROJECT_OWNER], workspaceBypass: [WORKSPACE_OWNER] }`; replace `addProjectMember`'s array form with `{ projectRoles: [PROJECT_OWNER, PROJECT_ADMIN], workspaceBypass: [WORKSPACE_OWNER] }`; add `removeProjectMember: { projectRoles: [PROJECT_OWNER, PROJECT_ADMIN], workspaceBypass: [WORKSPACE_OWNER] }` and `listProjectMembers: { projectRoles: [PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER], workspaceBypass: [WORKSPACE_OWNER, WORKSPACE_ADMIN] }`; verify by reading the diff and by `tsc --noEmit`
- [ ] 1.3 Update any existing unit tests in `server/tests/unit/common/authorization/` that reference `updateProjectRole` by name to use `updateProjectMemberRole`; verify `npm run test:unit` for the authorization files passes. Do NOT add new unit-test coverage for the matrix entries themselves — the guard's generic behavior (project-role allow, deny, workspace-bypass allow, missing entry deny) is already covered by the archived change's tests, and matrix entries are data whose effect is observed per-endpoint in section 6's integration tests.

## 2. New `project-roles` module (parallel to `workspace-roles`)

- [ ] 2.1 Create `server/src/modules/project-roles/project-role.schema.ts` and MOVE the `ProjectRoleName` enum into it from `server/src/modules/project-members/project-member.schema.ts`; add `ProjectRoleSchema` (shape `{ id, name, createdAt, updatedAt }` mirroring `WorkspaceRoleSchema`) and `export type ProjectRole = z.infer<typeof ProjectRoleSchema>`; verify `tsc --noEmit` (will still fail until 2.5)
- [ ] 2.2 Create `server/src/modules/project-roles/project-role.interface.ts` exporting `IProjectRoleRepository extends IRepository` with `getProjectRoles(): Promise<ProjectRole[]>`, `getProjectRoleById(id: string): Promise<ProjectRole | null>`, `getProjectRoleIdByName(name: ProjectRoleName): Promise<string>`; verify `tsc --noEmit`
- [ ] 2.3 Create `server/src/modules/project-roles/project-role.repository.ts` implementing `IProjectRoleRepository` using Prisma; mirror the shape of `WorkspaceRoleRepository` (same `select`, same `logError`, same `mapPrismaError` wrapping, same `resourceName = 'project_roles'`); MOVE the existing `getProjectRoleIdByName` implementation from `project-member.repository.ts` into this file; export singleton `projectRoleRepository`; verify `tsc --noEmit`
- [ ] 2.4 Create `server/src/modules/project-roles/index.ts` with `export * from './project-role.schema'`, `.interface`, `.repository`; verify `tsc --noEmit`
- [ ] 2.5 Migrate every existing import of `ProjectRoleName` from `@/modules/project-members` to `@/modules/project-roles`: `server/src/common/authorization/authorization-matrix.ts`, `server/src/modules/projects/project.service.ts`, `server/src/modules/project-members/project-member.repository.ts`, `server/src/modules/project-members/project-member.schema.ts` (if a transitional re-export is used — prefer direct import), and any test files that reference it; verify `npm run build` passes
- [ ] 2.6 Update `server/src/modules/projects/project.service.ts` to accept `projectRoleRepository: IProjectRoleRepository` in its constructor and switch the Owner-bootstrap call from `projectMemberRepository.getProjectRoleIdByName(PROJECT_OWNER)` to `projectRoleRepository.getProjectRoleIdByName(PROJECT_OWNER)`; update `server/src/modules/projects/index.ts` DI wiring to inject the new singleton; verify `npm run build` passes
- [ ] 2.6a Update `server/tests/integration/modules/projects/project.controller.fixtures.ts` to construct `projectRoleRepository = new ProjectRoleRepository(prisma, silentLogger)`, pass it to the new `ProjectService` ctor in the slot matching `projects/index.ts` DI order, add `projectRoleRepository: IProjectRoleRepository` to `ProjectsTestContext`, and return it alongside the other repositories so tests can `jest.spyOn` the same instance per `.cursor/rules/backend/integration-tests-pattern.mdc`; verify `tsc --noEmit`
- [ ] 2.6b In `server/tests/integration/modules/projects/project.controller.test.ts`, add an `on unexpected dependency failure (500)` sibling describe under `POST /` that spies on `ctx.projectRoleRepository.getProjectRoleIdByName` with `mockRejectedValueOnce`, asserts `expectInternalServerError`, and asserts `expectNoProjectWithName` for the attempted name — kept separate from the existing `on transaction rollback (500)` block because this call fires before `unitOfWork.run` and has nothing to roll back; verify `npm run test:integration -- projects` passes
- [ ] 2.7 Remove `getProjectRoleIdByName` from `server/src/modules/project-members/project-member.interface.ts` and `project-member.repository.ts`; the `project-members/index.ts` singleton no longer exposes it; verify `tsc --noEmit` passes with no remaining callers (section 2.5 and 2.6 should have cleared them all)

## 3. Project-member repository extensions

- [ ] 3.1 Extend `server/src/modules/project-members/project-member.schema.ts` with `ProjectMemberExpandedSchema` (shape `{ id, projectId, user: { id, name, email }, projectRole: { id, name } }`) and derived `ProjectMemberExpanded` type; keep existing `ProjectMemberWithRoleSchema` intact for the current actor-context callsite; verify by `tsc --noEmit`
- [ ] 3.2 Extend `server/src/modules/project-members/project-member.interface.ts` with `listProjectMembers(projectId: string): Promise<ProjectMemberExpanded[]>`, `getProjectMemberById(memberId: string, projectId: string): Promise<ProjectMemberExpanded | null>` (scoped so `(id, projectId)` mismatch returns `null`), `updateProjectMemberRole(memberId: string, projectRoleId: string): Promise<ProjectMemberExpanded>`, `deleteProjectMember(memberId: string): Promise<void>`; change `createProjectMember` to return `Promise<ProjectMemberExpanded>` (keep the same params); keep `getProjectMembersByUserId` unchanged; verify `tsc --noEmit`
- [ ] 3.3 Implement the four new methods in `server/src/modules/project-members/project-member.repository.ts` using Prisma with the expanded `select` that joins `user` (id, name, email) and `projectRole` (id, name); update `createProjectMember` to return the expanded row via `include` on the create; keep the stable ordering of `listProjectMembers` as `orderBy: { id: 'asc' }`; wrap every operation in try/catch with `logError` + `mapPrismaError` as the sibling methods do; verify `tsc --noEmit` and that `ProjectService.createProject` still compiles against the new return type
- [ ] 3.4 Confirm `project-members/index.ts` continues to export the singleton `projectMemberRepository` with the extended surface (minus `getProjectRoleIdByName`, now in `project-roles`); verify by `tsc --noEmit`

## 4. Project-member module scaffold (service, controller, types, DI)

- [ ] 4.1 Create `server/src/modules/project-members/project-member.types.ts` with request-level DTOs: `AddProjectMemberParams = { userId: string; projectRoleId: string }`, `UpdateProjectMemberRoleParams = { projectRoleId: string }`; verify `tsc --noEmit`
- [ ] 4.2 Extend `server/src/modules/project-members/project-member.schema.ts` with `AddProjectMemberRequestParamsSchema = z.strictObject({ userId: z.uuid(), projectRoleId: z.uuid() })` and `UpdateProjectMemberRoleRequestParamsSchema = z.strictObject({ projectRoleId: z.uuid() })` (mirroring the shape of the existing `UpdateUserRoleRequestParamsSchema`); verify `tsc --noEmit`
- [ ] 4.3 Create `server/src/modules/project-members/project-member.service.ts` implementing `IProjectMemberService` with four methods, each following the authorize-first ordering from `design.md` D6/D7, and resolving `projectRoleId` via the injected `projectRoleRepository.getProjectRoleById` (D12) to apply the ProjectOwner-rejection and ladder rules per D3/D11: `addProjectMember(actor, projectId, params)` (authorize -> project existence check -> resolve role id (`null` -> 422; `name === PROJECT_OWNER` -> 422) -> ladder check (`PROJECT_ADMIN` -> only `Developer` target) -> create -> return expanded); `listProjectMembers(actor, projectId)` (authorize -> project existence check -> repo list); `updateProjectMemberRole(actor, projectId, memberId, params)` (authorize -> fetch target (`null` -> 404; `target.projectId !== projectId` -> 404) -> owner-immutable check -> self-mutation check -> resolve new role id (`null` -> 422; `name === PROJECT_OWNER` -> 422) -> update -> return expanded); `removeProjectMember(actor, projectId, memberId)` (authorize -> fetch target (same 404 conditions) -> owner-protection check -> self-mutation check -> ladder check -> delete); throw `ResourceNotFoundError`, `BusinessRuleViolationError`, and go through `authorizationGuard.authorizeProject` as specified in `design.md` D1-D7; verify `tsc --noEmit`
- [ ] 4.4 Create `server/src/modules/project-members/project-member.interface.ts` `IProjectMemberService` interface with the four methods and matching signatures; verify `tsc --noEmit`
- [ ] 4.5 Create `server/src/modules/project-members/project-member.controller.ts` with `Router({ mergeParams: true })`, mounting `POST /`, `GET /`, `PATCH /:memberId`, `DELETE /:memberId` behind `requireAuthenticationMiddleware`; validate path params via `IdSchema.parse({ id: req.params.projectId })` and `.parse({ id: req.params.memberId })`, validate bodies via the two request schemas with `isPlainObject` guard; shape `{ data }` responses (201 on POST, 200 on PATCH, 204 empty on DELETE), and `{ data }` with NO `meta.pagination` on GET; reject any `page`/`pageSize`/`sort`/`filter[...]` query parameters as 400 via an explicit guard; verify `tsc --noEmit`
- [ ] 4.6 Update `server/src/modules/project-members/index.ts` to construct and export `projectMemberService` and `projectMemberController` singletons, with `ProjectMemberService` taking `(projectMemberRepository, projectRoleRepository, projectRepository, authorizationGuard, logger)` and `ProjectMemberController` taking `(projectMemberService)`; re-export schemas/interfaces/types; verify `npm run build` passes
- [ ] 4.7 Mount the controller in `server/src/app.ts` with `app.use('/api/v1/projects/:projectId/members', projectMemberController.router)`, placed with the other `/api/v1/...` routers (independent of the projects router mount); verify `npm run build` passes

## 5. Unit tests

- [ ] 5.1 Add `server/tests/unit/modules/project-members/project-member.service.test.ts` covering each service method, each authorization branch (project-role allow, project-role deny, workspace bypass allow, non-member deny), the target-role ladder for add and remove, the owner-protection rule for update and delete, the self-mutation rule for update and delete, the "role id does not resolve -> 422" and "role id resolves to Project Owner -> 422" paths for add and update, and the "member belongs to a different project -> 404" path for update and delete; follow `.cursor/rules/backend/unit-tests-pattern.mdc` exactly (read it before writing); verify `npm run test:unit:coverage` reaches full branch coverage on the new service file

## 6. Integration tests

Each endpoint's tests follow the canonical ordering: happy paths first, then validation (400), authentication (401), authorization/forbidden (403), not-found (404), conflict (409), business-rule violation (422), and internal server / dependency failures (500) last.

- [ ] 6.1 Add `server/tests/integration/modules/project-members/project-member.controller.test.ts` plus co-located `project-member.controller.fixtures.ts` and `project-member.controller.assertions.ts`; read `.cursor/rules/backend/integration-tests-pattern.mdc` first; verify `npm run test:integration -- project-members` executes
- [ ] 6.2 POST /projects/:projectId/members: cover
  - happy: Workspace Owner adds Project Admin, Workspace Owner adds Developer, Project Owner adds Project Admin, Project Owner adds Developer, Project Admin adds Developer; each returns 201 with the expanded body and persists the row;
  - 400: missing `userId`, missing `projectRoleId`, malformed `userId`, malformed `projectRoleId`, extra field, non-object body, malformed `:projectId`;
  - 401: unauthenticated;
  - 403: Workspace Admin without project role, Developer with Developer project role, non-member Developer;
  - 404: unknown `:projectId`;
  - 409: duplicate `(projectId, userId)`;
  - 422: unknown `userId` (FK violation), unknown `projectRoleId` (does not resolve to any project role), `projectRoleId` resolving to Project Owner, Project Admin attempting to add a Project Admin target (ladder);
  - 500: dependency failure via `jest.spyOn(projectMemberRepository, 'createProjectMember').mockRejectedValueOnce(...)`;
  - verify each scenario passes

- [ ] 6.3 GET /projects/:projectId/members: cover
  - happy: Workspace Owner on non-member project, Workspace Admin on non-member project, Project Owner member, Project Admin member, Developer member; response has `data` with expanded entries, NO `meta.pagination`; project with only the bootstrapped Project Owner returns one entry; stable ordering by `id` ascending;
  - 400: malformed `:projectId`, any of `?page=1`, `?pageSize=10`, `?sort=id`, `?filter[userId]=...`;
  - 401: unauthenticated;
  - 403: non-member Developer;
  - 404: unknown `:projectId`;
  - 500: dependency failure via `jest.spyOn(projectMemberRepository, 'listProjectMembers').mockRejectedValueOnce(...)`;
  - verify each scenario passes

- [ ] 6.4 PATCH /projects/:projectId/members/:memberId: cover
  - happy: Workspace Owner promotes Developer to Project Admin on non-member project, Project Owner promotes Developer to Project Admin, Project Owner demotes Project Admin to Developer; each returns 200 with the expanded body;
  - 400: missing `projectRoleId`, malformed `projectRoleId`, extra field, non-object body, malformed `:projectId`, malformed `:memberId`;
  - 401: unauthenticated;
  - 403: Workspace Admin without project role, Project Admin, Developer;
  - 404: unknown `:memberId`, member row belonging to a different project than `:projectId`;
  - 422: target is Project Owner (owner-immutable), target is self (self-mutation), unknown `projectRoleId` (does not resolve), `projectRoleId` resolving to Project Owner;
  - 500: dependency failure via `jest.spyOn(projectMemberRepository, 'updateProjectMemberRole').mockRejectedValueOnce(...)`;
  - verify each scenario passes

- [ ] 6.5 DELETE /projects/:projectId/members/:memberId: cover
  - happy: Workspace Owner removes Project Admin on non-member project, Workspace Owner removes Developer, Project Owner removes Project Admin, Project Owner removes Developer, Project Admin removes Developer; each returns 204 and the row is gone;
  - 400: malformed `:projectId`, malformed `:memberId`;
  - 401: unauthenticated;
  - 403: Workspace Admin without project role, Developer;
  - 404: unknown `:memberId`, member row belonging to a different project than `:projectId`;
  - 422: target is Project Owner (owner-protection), target is self (self-mutation), Project Admin attempting to remove a Project Admin target (ladder);
  - 500: dependency failure via `jest.spyOn(projectMemberRepository, 'deleteProjectMember').mockRejectedValueOnce(...)`;
  - verify each scenario passes

## 7. OpenAPI and documentation

- [ ] 7.1 Update `server/docs/openapi.json` to document the four project-member endpoints: `POST /projects/{projectId}/members`, `GET /projects/{projectId}/members`, `PATCH /projects/{projectId}/members/{memberId}`, `DELETE /projects/{projectId}/members/{memberId}`, their request/response schemas (expanded member resource), and the shared error responses; verify the spec validates and `/docs` renders the new routes

## 8. Lint, format, and full test run

- [ ] 8.1 Run `npm run prettier` and `npm run lint`; verify no issues reported
- [ ] 8.2 Run `npm run test`; verify unit and integration suites both pass

## 9. Spec validation

- [ ] 9.1 Run `openspec validate add-project-members-management --strict`; verify no errors
