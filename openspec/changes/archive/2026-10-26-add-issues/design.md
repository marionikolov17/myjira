## Context

See `proposal.md` for motivation. Relevant existing state the design builds on:

- The `Issue` Prisma model already exists with `title`, `description`, `status` (`ToDo | InProgress | Done`), `priority` (`Low | Medium | High`), `creatorId`, `projectId`, `assigneeId` (all non-null), `createdAt`, `updatedAt`, and indexes on `projectId`, `assigneeId`, `status`, and `priority`. `Issue.project` carries `onDelete: Cascade`, and `Subtask.issue` carries `onDelete: Cascade` вЂ” so project deletion already cascades to issues and issue deletion already cascades to subtasks without any application-layer code.
- The `authorization-matrix.ts` already contains three draft entries for issues (`createIssue`, `assignIssue`, `updateIssueStatus`), each granted to `[PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER]`. No live code references them.
- The `projects` and `project-members` modules together define the canonical module layout (controller / service / repository / schema / interface / types / query-config / `index.ts` DI wiring), the `Paginated<T>` list contract (`.cursor/rules/backend/repository-paginated-list.mdc`), the authorize-then-fetch service shape, and the `IdSchema.parse({ id: req.params.xxx })` controller validation pattern.
- The `project-members` module demonstrates the `(childId, projectId)` repository scoping pattern (`getProjectMemberById(memberId, projectId)` returns `null` when the member's `projectId` does not match), which this module adopts.
- `common/unit-of-work/` is available but not required here вЂ” none of the five endpoints writes to more than one table in a single operation. Issue creation is a single INSERT; delete cascades at the database layer.
- `common/query/` exposes `IQueryParser`, `QueryConfig`, `toPrismaFindArgs`, `buildPaginationMeta`, and the stable-order convention (append `{ id: 'asc' }` tiebreaker) that this module's list endpoint reuses.

## Goals / Non-Goals

**Goals:**

- Deliver all five issue endpoints behind one coherent `issues` capability that reuses the authorization matrix, routing primitives, pagination contract, and error taxonomy already in place.
- Make `(issueId, projectId)` mismatches surface as `404` structurally through repository scoping, without ad-hoc cross-checks in service code вЂ” the same discipline the `project-members` module uses for `(memberId, projectId)`.
- Keep every write operation reachable only via a URL that carries `projectId`, so the authorization decision is always "actor on this project" and never "actor on this issue, which lives in some project we have to look up first."
- Freeze the authorization matrix as the single source of truth for "who may call this endpoint," and treat per-field update rules (e.g., assignee-must-be-member) as named business rules in the service, not matrix extensions.

**Non-Goals:**

- Any status transition machine (open/closed graph, blocked-by, etc.) вЂ” status is any-to-any.
- Any assignee cleanup when a member is removed from the project вЂ” stale assignees are frozen (D7).
- Per-field authorization inside PATCH (e.g., "only Admin may change priority") вЂ” one `updateIssue` matrix entry governs the whole PATCH (D4).
- Soft-delete, archival, or an audit trail вЂ” delete is a hard delete, cascading to subtasks via the schema.
- Any issue-level cross-project operation (move, link to issue in another project).
- Any public endpoint, Zod schema, or type change outside `modules/issues/`, the authorization matrix/types, and `app.ts` вЂ” except the intentional `docs/04-api/api-design.md` В§4.5 update.

## Decisions

### D1. Every item-level operation is nested under `/projects/:projectId/issues/:id`

`docs/04-api/api-design.md` В§4.5 places create and list under the project path but strips `projectId` from GET-by-id, PATCH, and DELETE (`/issues/:id`). That shape forces the service to fetch the issue first, read its `projectId`, and only then call the authorization guard вЂ” the inverse of the authorize-then-fetch pattern used everywhere else in this codebase. It also lets a non-member who guesses an existing issue id distinguish "issue exists but I can't see it" (403 after fetch) from "issue does not exist" (404 after fetch), when the guard's job is precisely to deny before any lookup.

Nesting every operation under `/projects/:projectId/issues/:id` fixes both problems at once:

```
          api-design.md style              nested style
          -------------------              -------------
          PATCH /issues/:id               PATCH /projects/:pid/issues/:id
             |                                  |
             v                                  v
          service                            service
            fetch issue (I/O)                  authorize({ project: pid })
            if null -> 404                       -> 403 if denied
            authorize(issue.projectId)         fetch issue scoped to pid
            update                             update (null -> 404)

          Non-member distinguishes             Non-member sees 403 only;
          "exists but denied" vs                "exists" is never leaked
          "does not exist"                      to them
```

The nested shape also lets the repository scope every single-row operation by `(issueId, projectId)` (D2), eliminating cross-project enumeration without any ad-hoc service check.

`docs/04-api/api-design.md` В§4.5 is updated in the same change (task 7.1). The departure is intentional and documented.

**Alternatives considered:**

- *Honor `/issues/:id` as written and fetch-then-authorize* вЂ” rejected: inverts the authorize-then-fetch discipline the rest of the codebase relies on, leaks existence via 403-vs-404 distinction, and requires every item-level service method to carry its own cross-check code.
- *Expose both URL families (`/issues/:id` and `/projects/:pid/issues/:id`)* вЂ” rejected: double surface area, double tests, double OpenAPI entries for no gain. Pick one.
### D2. Reads are scoped at the repository; writes are scoped at the service via a pre-fetch

The `issue.repository.ts` interface is:

```
createIssue(params): Promise<Issue>                                           // projectId is in params
findIssues(options: QueryOptions, projectId: string): Promise<Paginated<Issue>>
getIssueById(issueId: string, projectId: string): Promise<Issue | null>
updateIssue(issueId: string, params): Promise<Issue>
deleteIssue(issueId: string): Promise<void>
```

Reads carry `projectId` and the repository enforces the scope atomically with the fetch: `findIssues` ANDs the parsed `where` with `{ projectId }`; `getIssueById` runs `findFirst({ where: { id, projectId } })` and returns `null` when the row either does not exist OR belongs to a different project. The repository manufactures no domain errors on reads вЂ” the service maps `null` into `ResourceNotFoundError`.

Writes take only the entity id. The service enforces `(issueId, projectId)` scoping by calling `getIssueById(issueId, projectId)` first and throwing `ResourceNotFoundError({ resourceName: issueRepository.resourceName })` when it returns `null`, then invoking the un-scoped `updateIssue(issueId, params)` / `deleteIssue(issueId)` on the repository. This is the same split `project-member.repository.ts` uses: `getProjectMemberById(memberId, projectId)` is scoped, while `updateProjectMemberRole(memberId, вЂ¦)` and `deleteProjectMember(memberId)` take only `memberId` and trust the service's pre-fetch. One convention across modules.

Concurrent-delete TOCTOU between the service's pre-fetch and the subsequent write surfaces as a Prisma `P2025` on the mutating call, which `mapPrismaError` translates to `ResourceNotFoundError` вЂ” the same 404 the user would see without the TOCTOU, with no mutation performed. The window is accepted codebase-wide; `project-member.service.ts` lives with the same window on `updateProjectMemberRole` and `removeProjectMember`.

Consequence worth naming: a Workspace Admin hitting `GET /projects/A/issues/XYZ` where XYZ actually belongs to project B is granted authorization (workspace bypass on `getIssueById`), then the repository returns `null` because the `(id = XYZ, projectId = A)` query matches no row. The admin gets a `404`, not a cross-project disclosure. The same mechanic protects PATCH and DELETE: the service's pre-fetch for `(XYZ, A)` returns `null`, the service throws 404, and no write is attempted. If the admin wants the issue, they go through `/projects/B/issues/XYZ`.

**Alternatives considered:**

- *Repository takes `(issueId, projectId)` on writes too and uses `updateMany` / `deleteMany` with `count === 0 в†’ ResourceNotFoundError`* вЂ” rejected: makes the "cross-project leak impossible at the type level" but introduces a new codebase-wide precedent of repositories manufacturing domain errors from clean Prisma results, duplicates the service's existing 404 check (which is already needed for the authorize-then-fetch shape in D3), and diverges from `project-member.repository.ts` for a stylistic TOCTOU closure whose user-visible outcome is identical to the plain `update` + `P2025` path. If and when that precedent is adopted codebase-wide, retrofit `project-members` and this module together.
- *Repository takes `issueId` only on both reads and writes, and the service compares `issue.projectId === pathProjectId` after an un-scoped fetch* вЂ” rejected: forces the service to carry the scoping check as an ad-hoc post-fetch comparison, which is easy to forget on a new mutation. Keeping the scope inside the repository's **read** signature (`getIssueById(issueId, projectId)`) means a correct pre-fetch is also a correct scope enforcement, with no extra line to omit.

### D3. Authorize-then-fetch service shape, matching `projects` and `project-members`

Every service method opens with `authorizationGuard.authorize({ scope: Project, action, resource: projectId })` **before any repository call**, matching `ProjectService.getProjectById` and `ProjectMemberService.updateProjectMemberRole`. This gives us one consistent control flow across modules:

```
service.<op>(actor, projectId, ...):
  authorize({ actor, scope: Project, action, resource: projectId })
  (for item ops) target = repo.getIssueById(id, projectId)
                       if (!target) throw ResourceNotFoundError
  (do the work)
```

For `createIssue` and `listIssues` the second block is omitted (nothing to fetch for existence first). For `createIssue` the service additionally verifies the project exists via `projectRepository.getProjectById(projectId)` **after** authorization and before the write, mirroring `addProjectMember` вЂ” otherwise a `createIssue` call for a non-existent project would authorize-pass (workspace bypass on nothing) and then surface as a Prisma FK violation rather than a clean 404. For `listIssues` the same project-existence check runs after authorization, matching `listProjectMembers`.

### D4. One `updateIssue` matrix entry governs the whole PATCH

The authorization matrix answers "may this actor call this endpoint." PATCH `/issues/:id` is one endpoint; it takes one authorization decision. Splitting it into per-field entries (`updateIssueTitle`, `updateIssueAssignee`, etc.) would make the service perform N authorization calls per request based on which keys appear in the body вЂ” a per-field access-control model this codebase has never adopted.

The pre-existing matrix entries `assignIssue` and `updateIssueStatus` were stubbed for exactly that split and are removed in this change (task 1.1). The replacement:
```
updateIssue: [PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER]
```

Any actor permitted to call `updateIssue` can update any subset of {title, description, status, priority, assigneeId} in the same PATCH. The functional requirements line "Project members can: Create, update and delete issues; Assign issues to users; Change issue status" lists these as capabilities of the project-member role as a whole, not as separately-granted permissions вЂ” which matches the collapsed model.

**Alternatives considered:**

- *Keep the three stubs and authorize per field in the service* вЂ” rejected: the functional requirements do not justify it, and it would be the first per-field authorization in the system.
- *Collapse to `updateIssue` but keep `assignIssue` and `updateIssueStatus` as unused matrix entries* вЂ” rejected: unused config is a lie waiting to happen. If a future change wants field-granular authorization, re-introduce them with intent.

### D5. Workspace Owner and Admin get read bypass on `listIssues` and `getIssueById`; writes stay project-member-only

Reads for `listIssues` and `getIssueById` are configured as `{ projectRoles: [PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER], workspaceBypass: [WORKSPACE_OWNER, WORKSPACE_ADMIN] }`. This matches the pattern already set by `getProjectById` and `listProjectMembers`: workspace-level operators can see any project's internals without being added as a member, which is the operationally expected shape of an "admin can audit" tier.

Writes (`createIssue`, `updateIssue`, `deleteIssue`) have **no** workspace bypass. Only project members can author or mutate issues. The rationale is twofold:

- Issue content is domain data (title, description, status) that project members own; Workspace Admins performing writes on behalf of a project without membership context invites footguns (creator-is-not-a-member, assignee-is-not-a-member, cross-project blast radius).
- Keeping writes membership-gated is also what preserves the "default assignee = creator" invariant in D6 вЂ” the creator is always a project member, so defaulting to them is always valid.

### D6. Create payload defaults: `status := ToDo`, `priority := Medium`, `assigneeId := creator`

Create accepts `{ title, description, priority?, assigneeId? }` as a `z.strictObject`. `status` is **forbidden** on create вЂ” the schema rejects it (strict object), the service always sets `ToDo`. There is no state in which a client sends a non-`ToDo` status on create; this removes a whole class of "created-as-Done" edge cases from the service.

`priority` defaults to `Medium` server-side when omitted. `assigneeId` defaults to the acting actor's user id when omitted вЂ” matching the Jira "self-assign at create" UX. The default is always valid because `createIssue` has no workspace bypass (D5), so every actor reaching the handler is already a project member of the target project.

When `assigneeId` is explicitly supplied, the service applies the "assignee must be a project member" check (D7) regardless of whether the id resolves to the creator themselves, the actor, or anyone else. The default-to-creator branch skips the check because the actor's membership is implied by their authorization.

**Alternatives considered:**

- *Require `assigneeId` on create (Option A from exploration)* вЂ” rejected: the Jira UX pattern of "create unassigned OR self-assign" is widespread; requiring an explicit choice at create time is more friction than value for an internal tool.
- *Make `assigneeId` nullable in the schema and default to `null`* вЂ” rejected: requires a Prisma migration (`assigneeId` is currently non-null), and "unassigned" surfaces complicate filtering/UI without a stated requirement.
- *Allow `status` on create with default `ToDo`* вЂ” rejected: no realistic use case for creating anything but a `ToDo` issue; `strictObject` rejection removes it from the attack/edge-case surface.

### D7. Assignee must be a current project member on both create and update; stale assignees are frozen

On create (when `assigneeId` is explicitly provided) and on update (when `assigneeId` appears in the body), the service calls `projectMemberRepository.getProjectMemberByUserAndProject(assigneeId, projectId)` (new repository method, see task 3.2) and throws `BusinessRuleViolationError('The specified assignee is not a member of this project')` with a 422 when it returns `null`. This is a named business rule, not a Prisma FK side effect вЂ” the user may exist and yet not be a member of the target project.

The default-assignee-is-creator branch (D6) skips this check because the creator's membership is implied by their authorization for `createIssue`.

Stale assignees are explicitly **frozen** as a non-goal. If a user is removed from the project after being assigned to an issue, the issue row still carries their `assigneeId`. Reads return the ex-member's `{ id, name, email }` as the assignee object. There is no cascading reassignment, no block-on-removal, no scan-on-member-remove. A future "stale assignee cleanup" change may add any of those; this change does not.

**Alternatives considered:**

- *Encode "member of the issue's project" as a Prisma check constraint / foreign-key composite* вЂ” rejected: Prisma doesn't express it ergonomically, and the business rule needs application-layer error shaping (422 with a specific code) rather than a generic DB error.
- *On project-member removal, re-assign all their issues to the project owner* вЂ” rejected: cascading mutations hide damage during a review of "what does removing this member do?" and are a separate story.
- *On project-member removal, refuse the removal if the user has open issues* вЂ” rejected: couples `project-members` to `issues`, and most teams would rather accept the stale pointer than block the removal.

### D8. List endpoint uses the shared `QueryConfig` / `IQueryParser` convention with the standard filter/sort set

The `issues.query-config.ts` file declares:

```
sortableFields:  ['createdAt', 'updatedAt', 'title', 'priority', 'status']
defaultPageSize: 10
maxPageSize:     100
filterableFields:
  status      -> ['eq', 'ne', 'in']           (enum)
  priority    -> ['eq', 'ne', 'in']           (enum)
  assigneeId  -> ['eq', 'ne', 'in']           (uuid)
  creatorId   -> ['eq', 'ne', 'in']           (uuid)
  createdAt   -> ['eq', 'gt', 'gte', 'lt', 'lte']
  updatedAt   -> ['eq', 'gt', 'gte', 'lt', 'lte']
```

The repository's `findIssues` passes options through `toPrismaFindArgs`, appends `{ id: 'asc' }` as the stable-order tiebreaker, and ANDs the parsed `where` with `{ projectId }` вЂ” the scoping discipline from D2.

Title text search and operator-style status queries ("status != Done") are deliberately absent вЂ” the standard `eq/ne/in` set covers "show me open issues" (`?filter[status][ne]=Done` or `?filter[status][in]=ToDo,InProgress`), "assigned to me" (`?filter[assigneeId]=<me>`), and date-range queries. Anything beyond that is a future change.

### D9. Response shape expands assignee and omits raw foreign-key scalars

Every endpoint that returns an issue returns the following shape:

```
{
  id, title, description, status, priority, projectId,
  creator:  { id, name, email },
  assignee: { id, name, email },
  createdAt, updatedAt
}
```
No `assigneeId`, `creatorId`, or raw scalar foreign keys on the output вЂ” the expanded objects are the public contract, matching how `project-members` expands `user` and `projectRole`. This keeps the client from accumulating two parallel ways to read the same relation (an id scalar and an expanded object) and avoids the "which one wins when they disagree" question entirely.

### D10. Delete is a hard delete; cascade to subtasks is a schema concern

`deleteIssue(issueId)` issues a single `prisma.issue.delete({ where: { id: issueId } })`. The service's pre-fetch (D2) guarantees the row exists in the target project before the delete runs; cross-project `(id, projectId)` mismatches return 404 from the service before any delete is attempted, consistent with D2. A concurrent delete between the pre-fetch and the `delete` surfaces as Prisma `P2025` в†’ `ResourceNotFoundError` via `mapPrismaError`, mirroring `project-member.repository.ts`'s `deleteProjectMember`. Subtasks are cascaded away by the existing `onDelete: Cascade` on `Subtask.issueId`; no application-layer cleanup is required.

There is no soft-delete, no `deletedAt`, no audit row. "Who deleted what and when" is a separate concern deferred to a future audit-log change вЂ” this change hard-deletes the row.

## Risks / Trade-offs

- **Risk**: Service pre-fetch discipline (D2) relies on every mutating service method calling `getIssueById(issueId, projectId)` before invoking the un-scoped write on the repository. A future mutation that skips the pre-fetch would re-open a cross-project enumeration window.
  в†’ **Mitigation**: `IIssueService` and the house pattern in `project-member.service.ts` both model the "authorize в†’ scoped pre-fetch в†’ write" shape, and D3's control-flow sketch names it explicitly. The integration-test scenarios "cross-project id yields 404" on PATCH and DELETE (tasks 9.5 / 9.6) catch regressions end-to-end; the service unit tests (task 8.1) cover the same branch at the service layer.
- **Risk**: Default-assignee-is-creator (D6) silently self-assigns when a client forgets to send `assigneeId`. A client that expected "unassigned by default" would be surprised.
  в†’ **Mitigation**: Document in OpenAPI (task 7.1) and in `docs/04-api/api-design.md`. The alternative (null-default) requires a schema change and complicates filtering for a UX regression вЂ” this trade favors Jira-standard behavior.

- **Risk**: Stale assignees after member removal (D7, non-goal) leave an issue pointing to a non-member. UIs listing "my issues" for that user would still include them even though they can no longer open the project.
  в†’ **Mitigation**: Documented as a known non-goal. The "stale assignee cleanup" change is tracked for a future proposal; this change does not block it.

- **Risk**: Departing from `docs/04-api/api-design.md` В§4.5 (D1) means any downstream reader of the old doc may wire a client against `/issues/:id`.
  в†’ **Mitigation**: `docs/04-api/api-design.md` В§4.5 is updated in the same change (task 7.1), and no `/issues/:id` route is mounted вЂ” a client wired against the old doc gets a `404` from Express's router, not a mysterious authorization error.

- **Risk**: Collapsing `assignIssue` and `updateIssueStatus` into `updateIssue` (D4) removes the hook a future "only PM may reassign" story might have reached for.
  в†’ **Mitigation**: If and when that story arrives, re-introduce the actions explicitly with the new rule written down. Dead draft config is a worse starting point than a clean matrix.

## Migration Plan

- The `Issue` Prisma model, its indexes, and its cascade behavior are already in place; no database migration is required.
- Deployment is purely additive from the HTTP perspective: five new endpoints appear, no existing endpoints change behavior. No client migration beyond "stop reading the old `/issues/:id` paths from `api-design.md`" is required because no such routes were ever shipped.
- Rollback is a straightforward revert of the `issues` module and the `authorization-matrix.ts` / `authorization.types.ts` edits. The pre-existing `assignIssue` and `updateIssueStatus` matrix entries are re-added on revert; no external contract referenced them.
