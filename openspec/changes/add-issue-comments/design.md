# Design

## Context

See `proposal.md` for motivation. The relevant constraints from the codebase:

- Server modules follow the fixed resource layout (controller → service → repository, Zod in
  `<name>.schema.ts`, DI in `index.ts`); authz goes exclusively through the declarative matrix +
  `IAuthorizationGuard`, never inline checks.
- Nested resources are mounted as their own routers with `mergeParams: true`
  (`/api/v1/projects/:projectId/members`, `/api/v1/projects/:projectId/issues`) — a third nesting
  level (issue → comments) is new but follows the same mechanism.
- The frontend contract chain is `lib/api/schemas` → `Transport` → `lib/api/client/*` → feature
  hooks; `lib/authz/can.ts` mirrors the server matrix; the issue detail view
  (`features/issues/components/detail/IssueDetailView.tsx`) is where comments render.
- Server-side Zod enforces presence/min only (e.g. `description: z.string().min(1)`); character
  maxima live in the client schemas (`ISSUE_TITLE_MAX_LENGTH`, `ISSUE_DESCRIPTION_MAX_LENGTH`).

## Goals / Non-Goals

**Goals:**

- Comments as a persistent, project-scoped subresource of issues with the standard module shape.
- Deletion restricted to the comment author, on top of role-based access.
- Frontend parity: schemas, transport, client, hooks, authz, and UI on the issue detail page.
- Full backend test coverage per the backend test rules (unit + integration).

**Non-Goals:**

- Editing comments, deleting others' comments (moderation), reactions, mentions/notifications.
- Pagination, filtering, or sorting of the comment list.
- Changing the existing issue endpoints, seeding sample comments, or tightening the server-side
  max-length validation posture of the API as a whole.

## Decisions

### D1 — Data model: standalone `Comment` table

```
model Comment {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  body      String
  issueId   String   @map("issue_id") @db.Uuid
  creatorId String   @map("creator_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  creator User  @relation("CommentCreator", fields: [creatorId], references: [id])
  issue   Issue @relation(fields: [issueId], references: [id], onDelete: Cascade)

  @@index([issueId])
  @@map("comments")
}
```

`creator` (not `author`) matches the `creatorId` convention used by `Project`, `Issue`, and
`Subtask`; `onDelete: Cascade` from `Issue` mirrors `Subtask` and satisfies the cascade requirement.
Alternative considered: embedding comments on `Issue` (JSON) — rejected: unbounded, no referential
integrity, no FK to the author.

### D2 — API surface: nested collection endpoints

Mounted in `app.ts` as `app.use('/api/v1/projects/:projectId/issues/:issueId/comments', commentController.router)`
with `Router({ mergeParams: true })`:

- `POST /` → 201 `{ data: Comment }`
- `GET /` → 200 `{ data: Comment[] }` (all comments of the issue)
- `DELETE /:commentId` → 204 no content

Path params (`projectId`, `issueId`, `commentId`) are validated as UUIDs in the controller, mirroring
the issue controller's path-parsing helpers. Alternative: top-level `/comments?issueId=…` — rejected:
every other resource is project-nested and the project scoping is what the authz guard keys on.

`Comment` response shape (server Zod owns it; client mirrors): `{ id, body, issueId, creator: { id,
name, email }, createdAt, updatedAt }` — consistent with `Issue` exposing `projectId` and a creator
ref. The nested `issue`-with-project chain is verified by the service (issue must exist in the given
project), so a mismatched `projectId`/`issueId` pair is a 404, not a leak.

### D3 — Unpaginated, oldest-first list

`GET /comments` returns the full collection ordered by `createdAt asc` (tiebreaker `id asc`) as
`{ data: Comment[] }`, mirroring the members endpoint precedent for bounded nested collections and
the repository rule that non-`QueryOptions` collections return bare arrays. No `query-config.ts` in
the module. Alternative: reuse the paginated query engine like issues — deferred; per-issue comment
volume doesn't justify the pagination UI, and adding `meta` later is backward-compatible for
clients that read `data`.

### D4 — Authorization: three new matrix actions + ownership rule in the service

Add to `AuthorizationAction` and the matrix (Project scope, `resource: projectId`):

- `listComments`: `{ projectRoles: [ProjectOwner, ProjectAdmin, Developer], workspaceBypass: [Owner, Admin] }`
- `createComment`: same config — per the confirmed product decision, anyone who can view an issue
  may comment (mirrors `getIssueById`).
- `deleteComment`: same config — the role check keeps the issue visible to the actor, and the
  service additionally enforces **ownership**: `comment.creatorId === actor.userId`, otherwise
  `AuthorizationError` (403).

Alternatives for delete: pure ownership check with no role authz (any authenticated user deletes
their own comment) — rejected: former project members would mutate data on issues they can no
longer see, and probe comment ids; matrix-only without ownership — rejected: that would let any
viewer delete anyone's comment, violating the core rule. 403 (not 422) is used for "not yours"
because it is a permission boundary, not a malformed-state business rule.

### D5 — Validation parity with issues

Server: `CreateCommentRequestParamsSchema = z.strictObject({ body: z.string().min(1) })`.
Client: `commentBody = z.string().trim().min(1).max(5000)` with `COMMENT_BODY_MAX_LENGTH = 5000`
exported from the client schema, mirroring how issue title/description are split (server enforces
min; client enforces trim + max). Introducing a server-side max only for comments would diverge
from every existing resource.

### D6 — Frontend wiring

- Schemas: new `app/src/lib/api/schemas/comments.ts` (`commentSchema`, `createCommentInputSchema`,
  `COMMENT_BODY_MAX_LENGTH`), exported via the schemas index.
- Transport: `listComments` (`collectionOf(commentSchema)`), `createComment` (`envelopeOf`),
  `deleteComment` (`requestVoid`) on the `Transport` interface + `httpTransport`.
- Client: `app/src/lib/api/client/comments.ts` (`commentsClient`), the only import surface for
  features.
- Query keys: top-level `comments` group in `lib/query/keys.ts` —
  `comments.issue(projectId, issueId) => ['comments', projectId, issueId]` — mirroring the
  one-resource-per-group pattern (`users`, `projects`, `members`, `issues`). Mutations invalidate
  that key. Nesting under the issue detail key was rejected: issue updates would needlessly
  refetch comments.
- Hooks colocated in the issues feature (comments have no screen of their own):
  `features/issues/comments/queries.ts` (`useIssueComments` unwraps `.data` to `Comment[]`, like the
  members hooks) and `features/issues/comments/mutations.ts` (`useCreateIssueComment`,
  `useDeleteIssueComment`, invalidate the comments key on success; no optimistic paint — matches the
  simpler existing mutation pattern).
- UI: `features/issues/components/detail/CommentsSection.tsx`, rendered in `IssueDetailView`'s main
  column under the description. Comment list (avatar/name, formatted timestamp, body), empty state,
  composer gated by `useCan('comments.create', { projectId })`, and a delete affordance with
  `ConfirmDialog` shown only when `comment.creator.id === actor.userId`.
- Authz mirror: add `comments.list`, `comments.create`, `comments.delete` to `lib/authz/can.ts`
  `ACTIONS`/`can()` (Owner/Admin bypass or project role — same logic as `issues.getById`).

### D7 — Tests

Backend only (frontend has a no-test policy):

- Unit: `tests/unit/modules/comments/comment.service.test.ts` + `comment.service.mock.ts`, with a
  shared `tests/unit/mocks/comment.repository.mock.ts`; cover authz delegation per action, issue
  not found, creator attribution from `actor.userId`, and the delete ownership rule (own, other's,
  author-without-access).
- Integration: `tests/integration/modules/comments/` with the three co-located files
  (`comment.controller.test.ts`, fixtures, assertions) following the integration pattern — route
  describes per endpoint, role-matrix `it.each` across actors, malformed-body matrices, auth
  failures, error helpers from shared assertions, plus persisted-state checks (created/removed
  rows; rejected requests leave no rows). Cascade: deleting an issue removes its comments.

## Risks / Trade-offs

- [Unpaginated comment payload grows with activity] → Acceptable at current scale; a paginated
  variant can be added later without breaking clients that read `data`. Revisit if long-running
  issues accumulate hundreds of comments.
- [Delete does a read-before-delete (ownership check)] → One extra indexed query per delete;
  consistent with the issue service's existing read-before-write pattern.
- [Removed members can no longer delete their own past comments] → Accepted for v1 and pinned by a
  spec scenario; moderation (delete-others) can be layered on later without changing these rules.
- [5000-char cap is client-only, so direct API calls can store longer bodies] → Same trade-off as
  issue descriptions today; a repo-wide server-side max policy is a separate change.

## Migration Plan

1. Add the `Comment` model and generate a migration (`npm run db:migrate` locally; the new table is
   purely additive — no backfill, no existing row changes).
2. Deploy server with the new module before/with the frontend; the endpoints are additive, so old
   clients are unaffected.
3. Rollback: revert the code; the table can be dropped independently (`comments` has no dependents).

## Open Questions

None — remaining details (exact UI copy, section styling) are safely deferrable to implementation
and do not change the specs, approach, or tasks.
