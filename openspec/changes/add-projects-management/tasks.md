## 1. Database schema and migration

- [ ] 1.1 Update `server/prisma/schema.prisma` to add `onDelete: Cascade` to `ProjectMember.project` (`project_id`), `Issue.project` (`project_id`), and `Subtask.issue` (`issue_id`); verify by inspecting the generated migration SQL contains three `ON DELETE CASCADE` clauses
- [ ] 1.2 Generate and apply migration `add_project_cascade_deletes` with `npm run db:migrate`; verify by running `npx prisma migrate status` and confirming the migration is applied

## 2. Authorization capability — `workspaceBypass`

- [ ] 2.1 Extend `AuthorizationAction` type in `server/src/common/authorization/authorization.types.ts` with `'listProjects'`, `'getProjectById'`, `'deleteProject'`; verify by `npm run build` passing
- [ ] 2.2 Add a `ProjectActionConfig` type `ProjectRoleName[] | { projectRoles: ProjectRoleName[]; workspaceBypass?: WorkspaceRoleName[] }` and update `AuthorizationMatrix[Project]` to use it; verify `tsc --noEmit` passes with existing entries unchanged
- [ ] 2.3 Add matrix entries: workspace `listProjects: [OWNER, ADMIN, DEVELOPER]`; project `getProjectById: { projectRoles: [PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER], workspaceBypass: [OWNER, ADMIN] }`; project `updateProject: { projectRoles: [PROJECT_OWNER], workspaceBypass: [OWNER] }` (replacing the existing array form); project `deleteProject: { projectRoles: [PROJECT_OWNER], workspaceBypass: [OWNER] }`; verify by reading the diff of `authorization-matrix.ts`
- [ ] 2.4 Update `AuthorizationGuard.authorizeProject` to normalize the entry (array vs. object), consult `workspaceBypass` first, and fall through to the existing project-role check; verify by `npm run build` passing (behavior verified in 2.5)
- [ ] 2.5 Add unit tests under `server/tests/unit/common/authorization/` covering: bypass permits non-member, bypass permits member whose project role would be denied, non-bypass workspace role falls through, action without bypass preserves old behavior, workspace-scope action is unaffected; verify `npm run test:unit:coverage` for the file reaches full branch coverage

## 3. Unit-of-work primitive

- [ ] 3.1 Create `server/src/common/unit-of-work/` with `unit-of-work.interface.ts` exporting `IUnitOfWork` and `TransactionalRepos { projects: IProjectRepository; projectMembers: IProjectMemberRepository }`; verify by `tsc --noEmit` passing after the projects / project-members interfaces exist (sequencing: do task 4.3 before this references them)
- [ ] 3.2 Implement `PrismaUnitOfWork` that wraps `prisma.$transaction(async (tx) => ...)`, constructs transaction-bound `ProjectRepository` and `ProjectMemberRepository` instances using `tx`, and invokes the callback with them; verify Prisma types for the client swap compile cleanly (`tsc --noEmit`)
- [ ] 3.3 Add an `index.ts` that exports the interface, the implementation, and a singleton `unitOfWork` constructed from the shared `prisma` client and `logger`; verify `tsc --noEmit` passes

## 4. Projects module scaffold

- [ ] 4.1 Create `server/src/modules/projects/project.schema.ts` with Zod schemas: `ProjectSchema` (`id`, `name`, `description`, `creatorId`, `createdAt`, `updatedAt`), `CreateProjectRequestParamsSchema` (strict object `{ name, description }`, both min(1)), `UpdateProjectRequestParamsSchema` (strict partial of name/description plus a refine that at least one is present); verify `tsc --noEmit`
- [ ] 4.2 Create `server/src/modules/projects/project.types.ts` with repository param types (`CreateProjectParams`, `UpdateProjectParams`, `ListProjectsResult = Paginated<Project>`, `ActorMembershipFilter = { userId: string } | undefined`); verify `tsc --noEmit`
- [ ] 4.3 Create `server/src/modules/projects/project.interface.ts` with `IProjectRepository` (`resourceName`, `createProject`, `findProjects(options, actorMembershipFilter?)`, `getProjectById`, `updateProject`, `deleteProject`) and `IProjectService` (`createProject`, `listProjects`, `getProjectById`, `updateProject`, `deleteProject`); verify `tsc --noEmit`
- [ ] 4.4 Create `server/src/modules/projects/project.query-config.ts` matching the spec (sortable `name/createdAt/updatedAt`; filterable `creatorId` and timestamp fields with declared operators; default pageSize 10, max 100; `name` NOT filterable; `description` neither); verify `tsc --noEmit` (behavior verified via integration tests in section 5)
- [ ] 4.5 Create `server/src/modules/projects/project.repository.ts` implementing `IProjectRepository` with Prisma, including: `createProject` returning the created row, `findProjects` using `toPrismaFindArgs(options)` with stable `orderBy` tiebreaker on `id`, membership filter translated to `where: { members: { some: { userId: ... } } }` when provided, `getProjectById`, `updateProject` (only `name`/`description` fields), `deleteProject` (single `prisma.project.delete`, cascade handled by DB); verify `tsc --noEmit` (behavior verified via integration tests in section 5)
- [ ] 4.6 Extend `project-members/project-member.interface.ts` and `project-member.repository.ts` with `createProjectMember({ projectId, userId, projectRoleId })` and `getProjectRoleIdByName(name: ProjectRoleName): Promise<string>` (throws `BusinessRuleViolationError` if not found); verify `tsc --noEmit` (behavior verified via integration tests in section 5)
- [ ] 4.7 Create `server/src/modules/projects/project.service.ts` implementing `IProjectService`: `createProject` resolves the Project Owner role id, uses `unitOfWork.run` to create project + bootstrap member; `listProjects` authorizes via workspace scope and derives the actor-membership scoping policy from `actor.workspaceRole.name`; `getProjectById`/`updateProject`/`deleteProject` authorize via project scope with the target id, then perform the operation (not-found maps via existence check and `ResourceNotFoundError` using the repository `resourceName`); verify by unit tests covering each method and each authorization branch
- [ ] 4.8 Create `server/src/modules/projects/project.controller.ts` mirroring the users controller: builds a Router in the constructor via `registerRoutes()`, mounts `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, each guarded by `requireAuthenticationMiddleware`; validates params via `IdSchema.parse(req.params)` and bodies via the request schemas with `isPlainObject` guard; shapes `{ data }` responses and `{ data, meta: { pagination } }` for the list using `buildPaginationMeta`; verify `tsc --noEmit` (behavior verified via integration tests in section 5)
- [ ] 4.9 Create `server/src/modules/projects/index.ts` wiring DI: construct `ProjectRepository`, `ProjectService` (with `projectMemberRepository`, `authorizationGuard`, `unitOfWork`, `logger`), `ProjectsController` (with service, `queryParser`, `projectsQueryConfig`); re-export schema/interface/types/query-config/repository/service and `projectsController`; verify `npm run build` passes
- [ ] 4.10 Mount the controller in `server/src/app.ts` under `/api/v1/projects`, placed with the other `/api/v1/...` routers; verify `npm run build` passes

## 5. Integration tests

Each endpoint's tests follow the canonical ordering: happy paths first, then validation (400), authentication (401), authorization/forbidden (403), not-found (404), and internal server / dependency failures (500) last.

- [ ] 5.1 Add `server/tests/integration/modules/projects/project.controller.test.ts` plus co-located `project.controller.fixtures.ts` and `project.controller.assertions.ts`; verify `npm run test:integration -- projects` executes

- [ ] 5.2 POST /projects: cover
  - happy: Workspace Owner success (201, body shape, Project Owner member row persisted); Workspace Admin success;
  - 400: empty `name`, empty `description`, missing fields, non-object body, disallowed extra fields (strict object);
  - 401: unauthenticated;
  - 403: Developer forbidden;
  - 500: transaction rollback when the member write fails — `jest.spyOn(projectMemberRepository, 'createProjectMember').mockRejectedValueOnce(...)` and assert no project row persists and a 500 response is returned;
  - verify each scenario passes

- [ ] 5.3 GET /projects: cover
  - happy: Workspace Owner sees all, Workspace Admin sees all, Developer sees only member projects (seed non-member projects and assert absence), Developer with no memberships returns empty data with `totalItems=0`/`totalPages=0`, pagination defaults when omitted, `sort=-createdAt`, `filter[creatorId]=<id>`, `filter[creatorId][in]=<a>,<b>`, `filter[createdAt][gte]=...`, partial-final-page metadata (25 items, pageSize 10, `totalPages=3`);
  - 400: reject `filter[name]`, reject `sort=description` and `filter[description]=...`, reject `pageSize` > 100, reject non-integer `page`/`pageSize`, reject unknown operator;
  - 401: unauthenticated;
  - 403: workspace role not in the `listProjects` matrix — follow the `users.controller.test.ts` convention of spying on `workspaceRoleRepository.getWorkspaceRoleById` to return a role whose `name` is a cast-to-type sentinel (e.g. `'Viewer' as WorkspaceRoleName`), so the actor context carries a workspace role outside the allowed set; expect `expectForbiddenError`;
  - 500: dependency failure — `jest.spyOn(projectRepository, 'findProjects').mockRejectedValueOnce(...)` returns 500;
  - verify each scenario passes

- [ ] 5.4 GET /projects/:id: cover
  - happy: Workspace Owner bypass on non-member project, Workspace Admin bypass on non-member project, Project Owner member, Project Admin member, Developer member;
  - 400: malformed id (not a UUID);
  - 401: unauthenticated;
  - 403: Developer who is not a member of the target project;
  - 404: well-formed id not referencing any project;
  - 500: dependency failure — `jest.spyOn(projectRepository, 'getProjectById').mockRejectedValueOnce(...)` returns 500;
  - verify each scenario passes

- [ ] 5.5 PATCH /projects/:id: cover
  - happy: Workspace Owner bypass on non-member project, Project Owner member, `name` only (description unchanged), `description` only (name unchanged), both fields;
  - 400: malformed id, empty payload, empty-string `name`, empty-string `description`, unknown field (strict object), non-object body;
  - 401: unauthenticated;
  - 403: Workspace Admin without Project Owner role, Project Admin, Developer;
  - 404: well-formed id not referencing any project;
  - 500: dependency failure — `jest.spyOn(projectRepository, 'updateProject').mockRejectedValueOnce(...)` returns 500;
  - verify each scenario passes

- [ ] 5.6 DELETE /projects/:id: cover
  - happy: Workspace Owner bypass on non-member project (204), Project Owner member (204), cascade removes seeded project_members / issues / subtasks (assert gone after delete);
  - 400: malformed id;
  - 401: unauthenticated;
  - 403: Workspace Admin without Project Owner role, Project Admin, Developer;
  - 404: well-formed id not referencing any project;
  - 500: dependency failure — `jest.spyOn(projectRepository, 'deleteProject').mockRejectedValueOnce(...)` returns 500;
  - verify each scenario passes

## 6. OpenAPI and documentation

- [ ] 6.1 Update `server/docs/openapi.json` to document the five project endpoints, their request/response schemas, and the shared error responses; verify the spec validates and `/docs` renders the new routes

## 7. Lint, format, and full test run

- [ ] 7.1 Run `npm run prettier` and `npm run lint`; verify no issues reported
- [ ] 7.2 Run `npm run test`; verify unit and integration suites both pass

## 8. Spec validation

- [ ] 8.1 Run `openspec validate add-projects-management --strict`; verify no errors
