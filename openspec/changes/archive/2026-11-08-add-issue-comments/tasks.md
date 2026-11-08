# Tasks

## 1. Database: Comment model and migration

- [x] 1.1 Add the `Comment` model to `server/prisma/schema.prisma` per design D1 (`body`, `issueId`
      cascade from `Issue`, `creatorId` with `User` back-relation `createdComments Comment[]` named
      `CommentCreator`, `comments Comment[]` on `Issue`, `@@index([issueId])`, `@@map("comments")`) and
      create the migration (e.g. `npx dotenv -e .env.local -- prisma migrate dev --name add_issue_comments`).
      Verify: `npm run db:migrate` applies cleanly and the regenerated Prisma client compiles
      (`npm run build` in `server/`).

## 2. Server: authorization actions

- [x] 2.1 Add `listComments`, `createComment`, `deleteComment` to `AuthorizationAction` in
      `server/src/common/authorization/authorization.types.ts` and to the Project scope matrix in
      `authorization-matrix.ts` with the D4 config (project roles: ProjectOwner, ProjectAdmin,
      Developer; workspaceBypass: Owner, Admin). Verify: `npm run test:unit` in `server/` — the
      existing authorization guard suite still passes.

## 3. Server: comments module

- [x] 3.1 Create `server/src/modules/comments/comment.schema.ts` (`CommentSchema` with `id`, `body`,
      `issueId`, nested `creator` ref, `createdAt`, `updatedAt`; `CreateCommentRequestParamsSchema` =
      `z.strictObject({ body: z.string().min(1) })`) and `comment.types.ts` (`CreateCommentParams`)
      per design D2/D5. Verify: `npm run build` in `server/` succeeds.
- [x] 3.2 Create `comment.interface.ts`: `ICommentRepository` (extends `IRepository`,
      `resourceName: 'comments'`; `createComment`, `getCommentsByIssueId`, `getCommentById(commentId,
issueId)`, `deleteComment`) and `ICommentService` (`listComments`/`createComment`/`deleteComment`
      taking actor + projectId + issueId). Verify: `npm run build` succeeds.
- [x] 3.3 Implement `comment.repository.ts`: select including the creator ref, `findMany` ordered
      `createdAt asc` + `id asc`, Zod-parse rows with `CommentSchema`, `mapPrismaError` + `logError`
      per the repository conventions. Verify: `npm run build` succeeds.
- [x] 3.4 Implement `comment.service.ts` per design D4: authorize each action (Project scope,
      resource `projectId`), verify the issue exists in the project via `IIssueRepository`
      (`ResourceNotFoundError` for `issues` otherwise), set `creatorId` from `actor.userId` on create,
      and on delete load the comment scoped to the issue (404 when absent) and throw
      `AuthorizationError` when `comment.creatorId !== actor.userId`. Verify: `npm run build` succeeds.
- [x] 3.5 Implement `comment.controller.ts` (`Router({ mergeParams: true })`: `POST /`,
      `GET /`, `DELETE /:commentId`; `isPlainObject` + schema validation; uuid path-param validation;
      `{ data }` envelopes with 201/200/204) and `index.ts` DI wiring, and mount the router in `app.ts`
      at `/api/v1/projects/:projectId/issues/:issueId/comments`. Verify: `npm run build` and
      `npm run lint` succeed in `server/`.

## 4. Server: comment service unit tests

- [x] 4.1 Read `.cursor/rules/backend/unit-tests-pattern.mdc` first (mandatory per
      `server/AGENTS.md`), then add `tests/unit/mocks/comment.repository.mock.ts`,
      `tests/unit/modules/comments/comment.service.mock.ts`, and `comment.service.test.ts` covering:
      authorization-guard delegation for all three actions, issue-not-found, creator attribution from
      `actor.userId`, delete-own invokes the repository, delete-another's-comment throws
      `AuthorizationError`, and comment-not-found. Match the issue service test structure. Verify:
      `npm run test:unit` in `server/` is green.

## 5. Server: comment controller integration tests

- [x] 5.1 Read `.cursor/rules/backend/integration-tests-pattern.mdc` first (mandatory per
      `server/AGENTS.md`), then create `tests/integration/modules/comments/comment.controller.fixtures.ts`
      (test context wiring the real comment repository/service/controller, exposing the wired-in
      `commentRepository` on the context per the `NB!` convention so the route 500 cases can
      `jest.spyOn` it; reuse shared fixtures like `seedProject` instead of duplicating them) and
      `comment.controller.assertions.ts` (comment response-shape and persisted-state helpers).
      Verify: `npm run build` in `server/` succeeds.
- [x] 5.2 Write `comment.controller.test.ts` with one describe per route and, inside each, the
      scenario describes in ascending status-code order (`on success` → `on validation failure (400)`
      → `on unauthenticated request (401)` → `on authorization failures (403)` → `on not found (404)`
      → `on unexpected dependency failure (500)`), matching the issue controller suite's ordering and
      phrasing:
      `POST /` — 201 success as an `it.each` role matrix across every authorized actor (including
      workspace Owner/Admin without a project role; each case asserts the full response shape and the
      persisted row); 400 malformed-body matrix (missing/empty/blank/wrong-type body, non-object body,
      extra fields) plus path-param validation, with no row persisted; 401 unauthenticated; 403
      non-viewer; 404 unknown issue; 500 with `jest.spyOn(ctx.commentRepository, 'createComment')`
      rejecting.
      `GET /` — 200 success (oldest-first ordering, cross-issue scoping, full shape); 400 path-param
      validation; 401; 403; 404 unknown issue; 500 with the comment repository list method rejecting
      (hand-written — the shared list-endpoint suite doesn't apply to the unpaginated comments route).
      `DELETE /:commentId` — 204 success (author deletes own comment, row gone from the DB); 400
      path-param validation; 401; 403 (another viewer's comment — row unchanged; author who lost
      project access — row unchanged); 404 unknown commentId; 500 with
      `getCommentById`/`deleteComment` rejecting.
      Reuse the shared error assertions everywhere. Verify: `npm run test:integration` in `server/`
      is green.
- [x] 5.3 Extend the issues module's `DELETE /:issueId` integration suite with an issue-comments
      cascade case, mirroring the existing subtasks cascade case (seed comments via Prisma, delete the
      issue through the API, assert zero comments remain). It belongs there because the comments test
      app doesn't mount the issue router. Verify: `npm run test:integration` in `server/` is green.

## 6. API contract and docs

- [x] 6.1 Update `server/docs/openapi.json`: add `GET`/`POST`
      `/projects/{projectId}/issues/{issueId}/comments` and `DELETE`
      `/projects/{projectId}/issues/{issueId}/comments/{commentId}` plus the `Comment` request/response
      schemas, matching the existing style. Verify: `npm run build` succeeds and `npm run dev` serves
      the updated spec at `/docs`.
- [x] 6.2 Add the `Comment` entity to `docs/02-domain/domain-model.md` and a `### 4.7 Comments`
      section to `docs/04-api/api-design.md` mirroring the implemented endpoints. Verify: the
      documented endpoints and responses match `server/docs/openapi.json`.

## 7. Frontend: contract layer

- [x] 7.1 Create `app/src/lib/api/schemas/comments.ts` — `commentSchema` mirroring the server Zod,
      and `createCommentInputSchema = z.object({ body: commentBody })` where the wire property `body`
      matches the server one-to-one and `commentBody` is the reusable field-level validator
      (`z.string().trim().min(1).max(5000)`, with `COMMENT_BODY_MAX_LENGTH = 5000`), mirroring
      `issueTitle`/`issueDescription` in the issues schemas — and export it from
      `app/src/lib/api/schemas/index.ts`. Verify: `npx tsc --noEmit` in `app/` passes.
- [x] 7.2 Add `listComments` (`Collection<Comment>`), `createComment` (`Envelope<Comment>`), and
      `deleteComment` (void) to the `Transport` interface and `httpTransport` implementation per
      design D6. Verify: `npx tsc --noEmit` passes.
- [x] 7.3 Create `app/src/lib/api/client/comments.ts` (`commentsClient.list`/`create`/`remove`)
      and add a top-level `comments` key group to `lib/query/keys.ts`
      (`comments.issue(projectId, issueId) => ['comments', projectId, issueId]`). Verify:
      `npx tsc --noEmit` passes.

## 8. Frontend: authz mirror and data hooks

- [x] 8.1 Add `comments.list`, `comments.create`, `comments.delete` to `ACTIONS` and the `can()`
      switch in `app/src/lib/authz/can.ts` mirroring the server matrix (project role or workspace
      Owner/Admin). Verify: `npx tsc --noEmit` passes.
- [x] 8.2 Create `app/src/features/issues/comments/queries.ts` (`useIssueComments` unwrapping
      `.data` to `Comment[]`) and `mutations.ts` (`useCreateIssueComment`, `useDeleteIssueComment`
      invalidating the comments key on success) per design D6. Verify: `npx tsc --noEmit` passes.

## 9. Frontend: comments UI on the issue detail page

- [x] 9.1 Create `app/src/features/issues/components/detail/CommentsSection.tsx`: comment list
      (avatar/name via `UserAvatar`, formatted timestamp, body), empty state, composer gated by
      `useCan('comments.create', { projectId })` with client-side validation (trim, min 1, max 5000)
      and `handleFormError` for `VALIDATION_ERROR`, and a `ConfirmDialog` delete affordance rendered
      only for the actor's own comments (`comment.creator.id === actor.userId`), with Sonner toasts on
      mutation results. Reuse existing common components instead of new one-offs. Verify:
      `npx tsc --noEmit` passes.
- [x] 9.2 Render `CommentsSection` in `IssueDetailView` in the main column under the description
      editor. Verify: `npm run lint` and `npx tsc --noEmit` in `app/` pass.
- [x] 9.3 Manual end-to-end check with `npm run dev` in both packages and the seeded users: post a
      comment on an issue as a project member and see it listed; confirm a workspace Owner/Admin who
      is not a project member can comment; delete your own comment and see it disappear; confirm the
      delete affordance is absent on another user's comment.

## 10. Final verification

- [x] 10.1 In `server/`: run `npm run prettier`, `npm run lint`, `npm run build`, and
      `npm run test` — all green.
- [x] 10.2 In `app/`: run `npm run prettier`, `npm run lint`, `npx tsc --noEmit` — all green.
- [x] 10.3 Cross-check every scenario in
      `openspec/changes/add-issue-comments/specs/issue-comments/spec.md` against an automated test or
      the manual check in 9.3, noting any gaps in the change before archiving.

## Workflow follow-up

- Archive the change after review via the archive workflow (`/opsx-archive`).
- Verify the archived spec (`openspec show issue-comments --type spec`) reflects the shipped
  behavior.
