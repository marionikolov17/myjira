## Context

See `proposal.md` for motivation. Relevant existing state the design builds on:

- The `projects` module ships five header-level endpoints and bootstraps the acting user as a `PROJECT_OWNER` project-member row inside `unitOfWork.run` on project creation.
- The `project-members` module exists at `server/src/modules/project-members/` with `project-member.interface.ts`, `project-member.repository.ts`, `project-member.schema.ts`, and an `index.ts` that exports singletons. It currently exposes `getProjectMembersByUserId`, `createProjectMember`, and `getProjectRoleIdByName`, and has NO service, NO controller, NO routes. The `ProjectMemberWithRole` schema already expands the project role.
- The `common/authorization/` capability enforces decisions through a declarative `scope + action -> allowed roles` matrix and already supports the `workspaceBypass` object shape for project-scope entries, introduced by the archived `add-projects-management` change.
- The `project_members` table has `@@unique([projectId, userId])` and `onDelete: Cascade` on `projectId`. The `project-member.repository.ts` extensions needed for this change can rely on both.
- `common/unit-of-work/` is available but not required here — none of the four endpoints writes to more than one table in a single operation.
- The `users` and `projects` modules together define the canonical module layout (controller / service / repository / schema / interface / types / query-config / `index.ts` DI wiring) that this module will adopt.

## Goals / Non-Goals

**Goals:**

- Deliver all four project-member endpoints behind one coherent `project-members` capability that reuses the authorization and routing primitives already in place.
- Keep the authorization capability's matrix as the single source of truth for "may this actor call this endpoint," and keep every target-aware or state-aware rule in the service as a named business rule.
- Preserve the invariant established by the header change: every project has exactly one `PROJECT_OWNER` member, forever, enforced structurally by the API surface (not just by social agreement).
- Make the folder layout independent of the URL hierarchy: the module stays flat under `modules/project-members/`, and the nested URL is expressed only at mount time in `app.ts`.

**Non-Goals:**

- Any Project Owner transfer, co-ownership, or batch add/remove endpoint.
- A "my memberships" cross-project list, or any member search by user name/email.
- Pagination, sorting, or filtering on the member list — always-full-set is sufficient at this stage.
- Soft delete, archival, or audit of membership changes.
- Promoting the target-role ladder (D1 below) into a declarative matrix concept. The matrix stays data-driven and target-agnostic; the ladder lives in the service.
- Any public endpoint, Zod schema, or type change outside `modules/project-members/` and the authorization matrix/types.

## Decisions

### D1. Target-role ladder is a service business rule, not an authorization matrix feature

The matrix answers "may this actor call this action." That decision is clean and I/O-free. The requirement that "a `PROJECT_ADMIN` may add or remove members only when the target's project role is `Developer`" is target-aware — the matrix would need to grow a predicate over the request body (for POST) or over the target member row (for DELETE) to express it. That contradicts the archived change's explicit non-goal of "no predicate-based ABAC."

The ladder therefore lives in `ProjectMemberService` as a named rule:

```
on POST { userId, projectRole }:
  if actor.projectRole === PROJECT_ADMIN and projectRole !== Developer:
    throw BusinessRuleViolationError("Project Admin may only add Developers")

on DELETE :memberId:
  target = projectMemberRepository.getProjectMemberById(memberId)
  if actor.projectRole === PROJECT_ADMIN and target.projectRole.name !== Developer:
    throw BusinessRuleViolationError("Project Admin may only remove Developers")
```

Workspace Owner bypass actors act as effective Project Owner and SKIP the ladder — the ladder check only runs when the actor's `project` role on the target project is `PROJECT_ADMIN`.

**Alternatives considered:**

- *Encode the ladder in the matrix as `{ projectRoles, targetRoleAtMost }`* — rejected: adds a new concept, drags target lookup into the authorization capability, and makes POST and DELETE take different matrix shapes (one checks the body, one checks a repository row). Not worth it for one rule in one module.
- *Split into two actions `addProjectDeveloper` / `addProjectAdmin`* — rejected: splits one HTTP endpoint across two matrix entries, which couples the matrix to request-body values. Ugly.
- *Put it in the controller* — rejected: the controller doesn't know the target's current role without a repository call, which doesn't belong at the controller layer.

### D2. Rename `updateProjectRole` to `updateProjectMemberRole`; narrow it to Project Owner + Workspace Owner bypass

The existing matrix action name reads "update the project's role," which is misleading — the action updates a project *member's* role. The rename is a plain renaming of the string literal in `AuthorizationAction` and the matrix key. No other module today references `updateProjectRole` (grep confirms it appears only in `authorization.types.ts` and `authorization-matrix.ts`), so the rename is a safe, scoped edit.

Narrowing from `[PROJECT_OWNER, PROJECT_ADMIN]` to `{ projectRoles: [PROJECT_OWNER], workspaceBypass: [WORKSPACE_OWNER] }` matches the project-write stance the header change established for `updateProject` and `deleteProject`: only the Project Owner, with Workspace Owner as the sole bypass.

### D3. Target role carried by opaque `projectRoleId`; ProjectOwner rejection is a 422

The target role in `POST /members` and `PATCH /members/:id` is carried by an opaque `projectRoleId: z.uuid()` field, mirroring the existing `UpdateUserRoleRequestParamsSchema` convention (`workspaceRoleId: z.uuid()`). The request schema sees a UUID and nothing more; the role's name is resolved at the service layer.

Rationale: project roles and workspace roles are structurally identical in this codebase — both are hardcoded TypeScript enums seeded into their own table and referenced by the authorization matrix. Treating them differently at the API-input layer would create a split convention for no local gain, and would make a future "unify role catalogs" refactor harder than it needs to be. The id convention also keeps internal role naming an internal concern — the public contract is "send the id of the role you want," not "send the string we happen to call that role today."

Taxonomy consequence:

- **400 `VALIDATION_ERROR`** — pure request-shape violations the schema can see: missing `projectRoleId`, non-UUID value, missing / malformed `userId`, extra field, non-object body, malformed path identifier.
- **422 `BUSINESS_RULE_VIOLATION`** — rejections that need to resolve the id or compare against actor/target state: `projectRoleId` does not resolve to any project role (D7, D11); `projectRoleId` resolves to the Project Owner role (never-assignable); target-role ladder (D1); Project Owner member cannot be removed (D4); Project Owner member role cannot be changed; actor cannot mutate their own membership (D5); FK violation on `userId` (user does not exist).
- **409 `CONFLICT`** — `(projectId, userId)` already has a project-member row.

The ProjectOwner-rejection semantics are still "never legal in any state of the system for this field," but the schema layer lacks the vocabulary to see it (every valid role id is a well-formed UUID), so the rejection fires in the service and surfaces as 422. Clients should branch on the stable error `code`, not on the HTTP status alone, when they need to distinguish ProjectOwner-rejection from the generic "unknown role id" case.

### D4. Project Owner cannot be removed; enforced in service

The `DELETE /members/:memberId` service path fetches the target member row (needed anyway for 404 and for D1's ladder check). If `target.projectRole.name === PROJECT_OWNER`, the service throws `BusinessRuleViolationError("The Project Owner cannot be removed")`, surfacing a 422 regardless of whether the actor is Project Owner, Project Admin, Workspace Owner bypass, or anyone else.

Combined with D3 and D5, this guarantees the structural invariant from `proposal.md`: every project has exactly one Project Owner member for its lifetime.

### D5. No self-mutation; enforced in service as its own named rule

Both `PATCH /members/:memberId` and `DELETE /members/:memberId` check `target.userId === actor.id` and throw `BusinessRuleViolationError("Actor cannot modify their own project membership")` -> 422. Modeled as its own named requirement in the spec (not folded into add/remove/update scenarios) so it is discoverable in the capability's table of contents.

This rule is independent of D4: Admin removing themselves and Developer removing themselves are blocked by D5 even though neither is the Project Owner.

### D6. `removeProjectMember` service — authorize first, then fetch target for business rules

The DELETE service shape is:

```
1. validate :projectId and :memberId as well-formed UUIDs (controller)
2. authorizationGuard.authorizeProject(actor, 'removeProjectMember', projectId)
     --> 403 if the actor cannot call the action; no DB round-trip wasted on
         a forbidden request
3. target = projectMemberRepository.getProjectMemberById(memberId)
     --> 404 if not found, or if the row's projectId does not match :projectId
4. D4 check: target.projectRole.name !== PROJECT_OWNER        --> 422 otherwise
5. D5 check: target.userId !== actor.userId                   --> 422 otherwise
6. D1 ladder check (only when actor's project role is PROJECT_ADMIN
     and not bypassed) — target.projectRole.name must be DEVELOPER --> 422 otherwise
7. projectMemberRepository.deleteProjectMember(memberId)
8. 204
```

Order matters for three reasons:

- **Codebase consistency.** `ProjectService.getProjectById`, `updateProject`, and `deleteProject` all authorize first and only then fetch the target for the 404 check. The same shape here keeps the layering uniform and the mental model one.
- **No wasted I/O for forbidden callers.** A request from an actor whose matrix entry does not permit the action short-circuits before touching the DB. This is both cheaper on the hot path and defensive: a user whose role is not even in the matrix should never trigger a repository call to answer their question.
- **No resource-existence enumeration (the stronger reason).** `authorizeProject` is I/O-free — it reads `actor.projectRoles` and `actor.workspaceRole` only, never the DB. Running it first means a non-bypass caller with no role on `:projectId` gets a uniform 403 whether the project (or the target member row) is missing or merely inaccessible, closing an id-enumeration side channel for anyone who can guess UUIDs. The 404 path is reachable only by callers who already passed step 2 — i.e. who were authorized on the project in the first place — and by Workspace Owner bypass actors, who are entitled to know what exists in the workspace. Swapping the order would turn every forbidden request against a missing resource into a 404, leaking existence to callers who had no claim on it. This is the primary reason to keep the order; the I/O-saving above is a secondary benefit.

The `getProjectMemberById` lookup is a new repository method. It is scoped by `projectId` (filtered in the `where` clause as `{ id: memberId, projectId }`) so that `DELETE /projects/A/members/<id-of-member-in-B>` returns 404, not a spurious success. Note that for a Developer who is not a member of either project, step 2 denies with 403 before the lookup ever runs — so the 404-vs-403 distinction only matters for callers who passed authorization in the first place (Project Owner / Project Admin on `:projectId`, or Workspace Owner via bypass).

**Alternative considered:** fetch target first (my original draft). Rejected: forbidden callers would still pay a DB read, and the shape diverges from the archived `projects` service convention.

### D7. `addProjectMember` service — authorize first, then verify parent project exists

The POST service shape:

```
1. validate :projectId (controller) and body (controller via Zod)
2. authorizationGuard.authorizeProject(actor, 'addProjectMember', projectId)
     --> 403 if the actor cannot call the action
3. projectRepository.getProjectById(projectId)
     --> 404 if the parent project does not exist
4. role = projectRoleRepository.getProjectRoleById(body.projectRoleId)
     --> 422 if role is null (unknown projectRoleId)
     --> 422 if role.name === PROJECT_OWNER (never assignable here)
5. D1 ladder check (only when actor's project role is PROJECT_ADMIN
     and not bypassed) — role.name must be DEVELOPER --> 422 otherwise
6. projectMemberRepository.createProjectMember({ projectId, userId: body.userId, projectRoleId: body.projectRoleId })
     --> 409 on (projectId, userId) uniqueness violation via mapPrismaError
     --> 422 if body.userId does not reference an existing user, via FK violation mapped by mapPrismaError
7. 201 { data: <expanded member> }
```

The authorize-first order matches the convention in `ProjectService` and avoids a DB round-trip for forbidden callers. More importantly, it prevents resource-existence enumeration — see D6's third bullet for the full rationale, which applies verbatim here. The 404 vs. 403 taxonomy stays clean along the same lines: a Developer trying to add a member to a non-existent project (or to any project they have no role on) gets 403, because they could not call the action regardless of the project's existence; a Workspace Owner (bypass) trying to add to a non-existent project gets 404, because they could call the action and the operation failed on the parent-project existence check.

Authorizing against a projectId that may not exist is safe because `authorizeProject` is I/O-free and matrix-based: it answers from `actor.projectRoles` and `actor.workspaceRole` only. For a non-existent project, `actor.projectRoles` has no entry, so the only way the action is permitted is via `workspaceBypass` — which is correct behavior.

`ProjectMemberService` takes `IProjectRepository` as a constructor dependency for the step-3 existence check — a legitimate cross-module reference, mirroring the way `ProjectService` depends on `IProjectMemberRepository` for the Owner bootstrap in the header change.

Step 4's `getProjectRoleById` lives on the new `IProjectRoleRepository` (D12). It is called on every write that touches a role, which is one indexed single-row read per write — acceptable, and matches the pattern of the existing `getProjectRoleIdByName` used by the Owner bootstrap. A future optimization could cache the three project-role rows in memory at service construction (they are seed data, immutable at runtime), but that is YAGNI for now.

The FK-violation-to-422 mapping in step 6 relies on existing `mapPrismaError` behavior; this change does not alter it. The alternative — pre-checking user existence with an extra query — is rejected as unnecessary round-trip; the FK already enforces it atomically.

### D8. Response shape expands both relations

Every member resource returned (list and single) has the shape:

```
{
  id, projectId,
  user: { id, name, email },
  projectRole: { id, name }
}
```

No raw `userId` / `projectRoleId` fields appear in the response (the ids are reachable via `user.id` / `projectRole.id`). Timestamps (`createdAt`, `updatedAt`) are OMITTED from the member resource for this iteration — they are not needed by any UI the functional requirements describe and we can add them later without a breaking change.

Rationale: the list endpoint is primarily "render the project team roster," which always needs the user's name/email and the role name. Returning only ids would force every caller to issue N+1 user lookups. The expansion is cheap at the DB layer (two joins) and keeps the response self-contained.

This differs from the `projects` capability's "no expansion at this layer" decision because the ergonomics of a membership list are fundamentally different from a project list: a project list is a paginated catalog, a member list is a complete, bounded roster meant to render as-is.

### D9. GET /members is always full-set; no query-config file

The response is a plain `{ data: ProjectMember[] }` with NO `meta.pagination`, NO `sort`, and NO `filter`. The route rejects any `page`, `pageSize`, `sort`, or `filter[...]` parameter as a 400 validation error so clients cannot grow a dependency on an unsupported contract.

No `project-member.query-config.ts` file is created. The `*.query-config.ts` artifact in `users` and `projects` exists to feed `queryParser`; this module does not call `queryParser` on any route, so the file would be a dead placeholder — and dead files are worse than an absent one for readers trying to understand the module. If a future change introduces a paginated/filterable members endpoint, that change creates the file as a first-class artifact at the same time.

Rationale for the always-full-set behavior itself: a project team is a small bounded set (typically <50). Full-set is simpler, cheaper on the server (no COUNT), and shaped like `getProjectMembersByUserId` which is already full-set. If a project ever grows past the "render-all-on-one-screen" limit we revisit this behind a separate change.

### D10. Module layout stays flat; URL hierarchy expressed at mount time

The folder structure is unchanged in shape: `modules/project-members/` sits next to `modules/projects/`, not inside it. The URL nesting (`/api/v1/projects/:projectId/members`) is expressed in `app.ts` as a single `app.use(...)` with `Router({ mergeParams: true })` on the member router so it sees `req.params.projectId`.

**Alternatives considered:**

- *Nest the folder under `modules/projects/members/`* — rejected: breaks the "one module, one flat path" convention baked into `server/AGENTS.md`, forces a one-off DI layout, and would need to repeat for `modules/projects/issues/subtasks/` under the same logic.
- *Mount the member router from inside `projects.controller.ts`* — rejected: couples the two modules at the controller layer, breaks the "controllers mount in `app.ts`" pattern, and makes DI wiring order-sensitive.

### D11. Repository extensions on `IProjectMemberRepository`

Four new methods on `IProjectMemberRepository` / `ProjectMemberRepository`:

- `listProjectMembers(projectId: string): Promise<ProjectMemberExpanded[]>` — returns the full set for the project, expanded with `user` and `projectRole`. Returns `T[]` directly per the repo-paginated-list rule (not `Paginated<T>`), since the collection is bounded and not `QueryOptions`-driven.
- `getProjectMemberById(memberId: string, projectId: string): Promise<ProjectMemberExpanded | null>` — target lookup for PATCH/DELETE, expanded, scoped by `(id, projectId)` so a mismatched member/project combo returns `null`. Service maps `null` to 404 using the repository `resourceName`.
- `updateProjectMemberRole(memberId: string, projectRoleId: string): Promise<ProjectMemberExpanded>` — updates and returns the expanded row.
- `deleteProjectMember(memberId: string): Promise<void>` — hard delete of the member row only (no cascade needed; project membership has no children).

`createProjectMember` is extended to return `ProjectMemberExpanded` instead of `void`, so POST can respond with the expanded body without a second fetch. This is additive at the type level and does not break the existing header-change caller — `ProjectService.createProject` currently ignores the return value and will continue to work regardless.

The existing `getProjectMembersByUserId` is unchanged. The existing `getProjectRoleIdByName` method **moves out** of this repository entirely — see D12.

### D12. New `project-roles` module (mirrors `workspace-roles`)

Project roles get their own module at `server/src/modules/project-roles/`, structurally identical to `server/src/modules/workspace-roles/`:

```
project-roles/
  project-role.schema.ts      ProjectRoleName enum (moved from project-members),
                              ProjectRoleSchema, ProjectRole type
  project-role.interface.ts   IProjectRoleRepository
  project-role.repository.ts  PrismaProjectRoleRepository with:
                              - getProjectRoles(): Promise<ProjectRole[]>
                              - getProjectRoleById(id): Promise<ProjectRole | null>
                              - getProjectRoleIdByName(name): Promise<string>
  index.ts                    exports schema, interface, repository, singleton
```

`ProjectMemberService` depends on `IProjectRoleRepository` to resolve `body.projectRoleId` into a role name for the ProjectOwner-rejection and ladder checks on both POST and PATCH (`projectRoleRepository.getProjectRoleById(id)` — `null` -> 422; `role.name === PROJECT_OWNER` -> 422).

`ProjectService.createProject` migrates its Owner-bootstrap call from `projectMemberRepository.getProjectRoleIdByName(PROJECT_OWNER)` to `projectRoleRepository.getProjectRoleIdByName(PROJECT_OWNER)`. One injected dependency, one callsite change.

The `ProjectRoleName` enum moves from `project-member.schema.ts` to `project-role.schema.ts`; imports in `authorization-matrix.ts`, `project.service.ts`, `project-member.repository.ts`, and any tests update their import path from `@/modules/project-members` to `@/modules/project-roles`.

**Why do this inside this change rather than as a prerequisite:**

- The current state is a pre-existing asymmetry: `workspace-roles` is its own module, `project-roles` is not. This change is the first time anything other than the Owner bootstrap needs to look up project roles, so it is also the first time the asymmetry has a concrete cost.
- The move is small (one new 4-file module, four modified imports, one modified DI wiring) and strictly additive at the behavior level — no business rule or endpoint behavior changes because of it.
- Sequencing it as a prerequisite change would double the overhead for zero architectural improvement; it would just push the same four files into a different commit.

**Alternatives considered:**

- *Add `getProjectRoleById` to `IProjectMemberRepository`* (my original D11) — rejected: entrenches the asymmetry and makes `project-members` the de-facto owner of project-role lookups, which is wrong-ownership for the same reason `workspace-roles` doesn't live inside `users`.
- *Keep `ProjectRoleName` in `project-member.schema.ts` and re-export it from `project-roles`* — rejected: creates two canonical import paths for the same symbol; cheaper short-term but confusing to new readers forever.
- *Also move the `getProjectRoleIdByName` call site inside `ProjectService` to use the new `getProjectRoleById(ownerIdLookup)?.id`* — rejected as unnecessary churn; `getProjectRoleIdByName` is a legitimate convenience, and the method just moves modules without changing shape.

## Risks / Trade-offs

- **[Risk] The target-role ladder (D1) is prose-in-code rather than data-driven.** -> Mitigation: it is one named `assertCanActOnTarget(actor, targetRole)` helper on the service, unit-tested exhaustively against the role matrix. If a second module ever needs the same pattern we promote it.
- **[Risk] Expanding `user` in responses leaks `email` to any project member.** -> Mitigation: email is already visible via `GET /users` to any workspace member, so this is not a new disclosure surface. If we tighten `GET /users` later, we revisit this decision.
- **[Trade-off] `createProjectMember` returning the expanded row (D11) couples that method's shape to the HTTP concern of "respond with the full resource."** -> The alternative — a second fetch inside the service — is a strictly worse database profile for an identical outcome. Accepted.
- **[Trade-off] GET /members being always-full-set (D9) means a pathological project with thousands of members returns a very large payload.** -> Documented. The spec's non-goal section notes pagination may be added later behind a separate change without breaking the current contract (adding `meta.pagination` is additive; adding `?page`/`?pageSize` support is additive).
- **[Trade-off] The ladder (D1) and the self-mutation rule (D5) both surface as 422 with human-readable messages, which couples the UI to those exact strings if it wants to show tailored error text.** -> Mitigation: both business rules get stable `BUSINESS_RULE_VIOLATION` codes in the unified error payload; the UI should branch on code, not message. Message text is documentation, not contract.

## Migration Plan

No database migration. No existing code paths change behavior. Deployment order:

1. Ship the server with the four new endpoints and the updated matrix in a single release.
2. **Rollback**: a prior server image continues to work unchanged — the schema is identical, the matrix changes are backwards-safe (narrower `addProjectMember` and renamed `updateProjectRole`; the only callsite of the renamed action is the matrix itself and the eventual new controller, both in this same release).

There is no data backfill — existing projects (bootstrapped with their Project Owner member by the header change) are unaffected.
