# Proposal

## Why

Issues currently have no in-app discussion mechanism, so users have to collaborate out of band
(chat, email) with no record attached to the work item. Comments let users discuss, question, and
keep each other updated directly on the issue, where the collaboration lives alongside the issue's
data.

## What Changes

- Introduce a first-class **Comment** entity: text posted by a user on an issue, timestamped.
- New API surface nested under issues:
  - `POST /projects/{projectId}/issues/{issueId}/comments` — create a comment (201).
  - `GET /projects/{projectId}/issues/{issueId}/comments` — list an issue's comments, oldest first (200).
  - `DELETE /projects/{projectId}/issues/{issueId}/comments/{commentId}` — delete a comment (204).
- **Create/list access**: anyone who can view the issue — project members (Project Owner, Project
  Admin, Developer) plus workspace Owner/Admin (mirrors `getIssueById`).
- **Delete access**: the comment's author only. Users can never delete someone else's comment.
- New UI: a comments section on the issue detail page — discussion list, a composer, and a
  delete-with-confirm action shown only on the actor's own comments.
- Deleting an issue cascades to its comments.
- Out of scope for now: editing comments, deleting others' comments (moderation),
  mentions/notifications/reactions, and paginating the per-issue comment list.

## Capabilities

### New Capabilities

- `issue-comments`: Users can discuss an issue by posting comments that are visible to everyone
  who can view that issue, and can remove their own comments. No other comment mutations exist.

### Modified Capabilities

None. No specs exist yet (`openspec/specs/` is empty), so there are no existing capabilities whose
requirements change.

## Impact

- **Database**: `server/prisma/schema.prisma` — new `Comment` model (author, issue, body,
  timestamps; cascade on issue delete) + a new migration.
- **Server module**: new `server/src/modules/comments/` following the standard resource module
  layout (controller, service, repository, schema, interface, types, index; no `query-config` —
  the list is not `QueryOptions`-driven).
- **Authorization**: `server/src/common/authorization/` — new actions `listComments`,
  `createComment`, `deleteComment` added to `AuthorizationAction` and the declarative matrix.
- **Routing**: `server/src/app.ts` — mount the comment router under
  `/api/v1/projects/:projectId/issues/:issueId/comments`.
- **API contract**: `server/docs/openapi.json` — three new operations plus `Comment` request/response
  schemas; `server/docs` remains the source of truth the frontend mirrors.
- **Server tests**: unit tests for the comment service (authz, ownership, not-found paths) and
  integration tests for the comment controller, per the backend test rules.
- **Frontend**: `app/src/lib/api/schemas/comments.ts`, transport + `commentsClient`, query keys,
  `lib/authz/can.ts` (mirror the new matrix actions), and a comments section wired into
  `features/issues` on the issue detail view.
- **Docs**: add the Comment entity to `docs/02-domain/domain-model.md` and a Comments section to
  `docs/04-api/api-design.md`.
