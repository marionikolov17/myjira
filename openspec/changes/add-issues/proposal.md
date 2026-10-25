## Why

The server has a projects header and a project-members roster, but no way to track work inside a project — no issue creation, listing, retrieval, update, or deletion. The functional requirements name issues as the primary unit of project work ("Project members can: Create, update and delete issues; Assign issues to users; Change issue status") and the Prisma schema already defines the `Issue` model, but no HTTP surface, service, repository, or authorization bindings exist to put it to use. Shipping this capability activates the only remaining project-scoped write surface before subtasks, and establishes the enumeration-safe, authorize-then-fetch pattern that subtasks will reuse.

## What Changes

- Add an `issues` HTTP surface mounted under `/api/v1/projects/:projectId/issues`, with every operation nested under the project path — including the item-level ones that `docs/04-api/api-design.md` §4.5 currently places at `/issues/:id`:
  - `POST   /`           — create an issue in the project.
  - `GET    /`           — list the project's issues with pagination, filtering, and sorting.
  - `GET    /:id`        — retrieve a single issue scoped to the project.
  - `PATCH  /:id`        — partial update of title, description, status, priority, or assignee.
  - `DELETE /:id`        — remove the issue (cascades to its subtasks via the existing schema).
- Depart from `docs/04-api/api-design.md` §4.5 on URL shape and update that document in the same change. The nested path makes `projectId` a required path parameter for every item-level operation, which lets the service authorize-then-fetch (same discipline as the `projects` and `project-members` modules), preserves the 403-before-404 convention for non-members, and prevents cross-project enumeration via the repository's `(issueId, projectId)` scoping.
- Introduce four new authorization actions in `authorization-matrix.ts` and tighten the pre-existing issue stubs:
  - `createIssue`: unchanged scope, kept as `[PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER]`.
  - `listIssues`: `{ projectRoles: [PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER], workspaceBypass: [WORKSPACE_OWNER, WORKSPACE_ADMIN] }` (read bypass matches `listProjectMembers`).
  - `getIssueById`: `{ projectRoles: [PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER], workspaceBypass: [WORKSPACE_OWNER, WORKSPACE_ADMIN] }`.
  - `updateIssue`: `[PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER]` (one entry governs any subset of title / description / status / priority / assignee in the same PATCH; no per-field authorization).
  - `deleteIssue`: `[PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER]`.
  - **BREAKING (internal only)**: remove the pre-existing `assignIssue` and `updateIssueStatus` entries from `authorization.types.ts` and `authorization-matrix.ts`. They were stubbed for a design that split the update into field-granular authorization and are superseded by the single `updateIssue` action. No live code references them.
- Enforce three named business rules in `IssueService`:
  - **Assignee must be a current member of the issue's project** on create and on update (422 when the user is not a member).
  - **Status and priority** accept any enum value with no transition rules (any-to-any for status, free choice for priority).
  - **Stale assignees are frozen** — a member removed from the project after being assigned keeps the assignment; no cascade (non-goal, deferred to a future "stale assignee cleanup" change).
- Creation payload accepts `{ title, description, priority?, assigneeId? }` and server-sets the rest:
  - `status` is forbidden on create (strict object rejects it) and set to `ToDo`.
  - `priority` defaults to `Medium` when omitted.
  - `assigneeId` defaults to the creator when omitted — matching the Jira "self-assign at create" UX, and always valid because `createIssue` has no workspace bypass so the creator is necessarily a project member.
- Scaffold the full module under `server/src/modules/issues/`: `issue.service.ts`, `issue.controller.ts`, `issue.repository.ts`, `issue.schema.ts`, `issue.interface.ts`, `issue.types.ts`, `issue.query-config.ts`, and an `index.ts` that wires DI singletons. The controller mounts a single `Router({ mergeParams: true })` so it sees `req.params.projectId` on every route.
- Expand the issue response resource to include the project id and the assignee's `{ id, name, email }` on all four endpoints that return an issue, mirroring how project-members expand user and projectRole.
- Repository exposes `createIssue`, `findIssues(options, projectId)`, `getIssueById(issueId, projectId)`, `updateIssue(issueId, params)`, and `deleteIssue(issueId)`. Reads carry `projectId` so `(issueId, projectId)` mismatches surface as `null` (and therefore `404`) at the service; writes take only `issueId` and the service enforces the scope by calling `getIssueById(issueId, projectId)` before invoking them — the same split `project-member.repository.ts` uses (see design D2).
- Update `docs/04-api/api-design.md` §4.5 to document the nested URLs and the new filtering/sorting fields.

## Capabilities

### New Capabilities

- `issues`: Project-scoped lifecycle of an issue — creating issues in a project, listing them with pagination/filter/sort, retrieving one, partially updating title / description / status / priority / assignee, and deleting one (cascading to its subtasks via the schema). Owns the "assignee must be a project member" and "stale assignees frozen" business rules, the expanded issue response shape, the default-assignee-is-creator rule, and the five actions' project-scope authorization bindings (declared here, implemented by the authorization capability).

### Modified Capabilities

None. The authorization matrix additions, removals, and the single collapsed `updateIssue` entry all live in `authorization-matrix.ts` and `authorization.types.ts` (code), not in `authorization/spec.md` (which describes the capability's concepts). This change introduces no new authorization concept — it reuses `workspaceBypass` as-is and uses the existing project-scope resource identifier (`projectId`) throughout.

## Impact

- **New code**: `server/src/modules/issues/issue.service.ts`, `issue.controller.ts`, `issue.repository.ts`, `issue.schema.ts`, `issue.interface.ts`, `issue.types.ts`, `issue.query-config.ts`, `index.ts`.
- **Modified code**: `server/src/common/authorization/authorization.types.ts` (add `listIssues`, `getIssueById`, `updateIssue`, `deleteIssue`; remove `assignIssue`, `updateIssueStatus`); `server/src/common/authorization/authorization-matrix.ts` (new entries per the delta above; removal of `assignIssue`, `updateIssueStatus`); `server/src/app.ts` (mount `/api/v1/projects/:projectId/issues`); `docs/04-api/api-design.md` §4.5 (nested URLs, documented filter/sort fields).
- **Database**: None. The `Issue` model, its indexes (`projectId`, `assigneeId`, `status`, `priority`), and the `onDelete: Cascade` from `Issue.project` and from `Subtask.issue` already satisfy the scoping and delete-cascade requirements.
- **API**: Five new public endpoints under `/api/v1/projects/:projectId/issues`; no existing endpoints change behavior.
- **Tests**: Unit tests for the new service branches (authorization branches per endpoint, assignee-is-member rule, default-assignee resolution, cross-project-id scoping); integration tests for the five endpoints following the fixtures/assertions co-location pattern established by `project-members`.
- **Out of scope**: Subtasks (next change), comments, attachments, labels, free-text title search, soft-delete, audit log / activity feed, stale-assignee cleanup on member removal, status transition rules, per-field authorization inside PATCH, and any issue-level cross-project operation.
