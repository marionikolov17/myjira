## Why

`docs/04-api/api-design.md` §4.2 defines `GET /users` as a paginated, filterable, sortable list endpoint, and every future workspace/project feature (assigning issues, adding project members, admin views) needs a way to enumerate workspace users. The user-management capability today only covers creation (`POST /users`) plus `GET /users/me`; there is no route to list users. With the shared `query-parameters` capability already in place (archived 2026-09-13 change), we can now add `GET /users` as the first list endpoint that actually consumes those conventions, giving downstream features a real, tested consumer of the shared query layer and closing the biggest gap in the user-management surface.

## What Changes

- Add a `UserService.listUsers()` use case that returns a page of workspace users plus the total item count, driven by a normalized `QueryOptions` value from the shared `query-parameters` capability.
- Expose `GET /api/v1/users` (authenticated) in the users controller. The controller parses `page`, `pageSize`, `sort`, and `filter[...]` from `req.query` through the shared `IQueryParser` using a per-resource `QueryConfig`, calls the service, computes `meta.pagination` via the shared meta builder, and returns the collection envelope `{ data, meta: { pagination } }` with `200 OK` — matching `docs/04-api/api-design.md` §4.2, §5, and §6.2.
- Enforce authorization via the existing `AuthorizationGuard` on the `workspace` scope with a new `listUsers` action. Allowed roles: **Workspace Owner, Workspace Admin, and Developer** — every authenticated workspace member needs to enumerate users to support later assignment/membership flows.
- Add a `UserRepository.findUsers()` method that translates `QueryOptions` into Prisma `findMany` + `count` arguments via the shared `prisma-query-mapper`, returning `{ items, totalItems }`.
- Define a users-list `QueryConfig` declaring:
  - **Sortable fields**: `name`, `email`, `createdAt`, `updatedAt`.
  - **Filterable fields with operators**: `name` (`eq`, `ne`, `in`), `email` (`eq`, `ne`, `in`), `workspace_role_id` (`eq`, `ne`, `in`), `status` (`eq`, `ne`, `in`), `createdAt` / `updatedAt` (`eq`, `gt`, `gte`, `lt`, `lte`).
  - **Pagination**: default `pageSize` = 10, maximum `pageSize` = 100.
- Never expose password, password hash, or activation-token fields in list items; the response shape mirrors the safe fields returned by `POST /users` (id, name, email, workspace_role_id, status, timestamps).
- Wire the new dependencies through the users module `index.ts` (inject `IQueryParser` and a `usersQueryConfig` into `UsersController`).

## Out of Scope

- Cursor-based pagination or any operator beyond those already supported by the `query-parameters` capability.
- Full-text search over users (would require a new operator).
- `GET /users/{id}` and updates to `GET /users/me` — separate reads.
- Broadening or reshaping the `query-parameters` capability itself; this change only consumes it.
- Any change to how creation, activation, or role assignment behave.

## Capabilities

### New Capabilities

<!-- None. The list endpoint extends existing capabilities rather than introducing a new one. -->

### Modified Capabilities

- `user-management`: Add requirements for authorized listing of workspace users — who may list (Owner, Admin, Developer via a new `listUsers` matrix entry), that parsing, validation, and pagination metadata are delegated to the `query-parameters` capability under a declared users `QueryConfig` (sortable/filterable fields, operators, page-size cap), and the response envelope shape for the collection, including the guarantee that no credential or activation-token fields are ever exposed in list items.

## Impact

- **Code (server)**:
  - `src/modules/users/user.service.ts` — add `listUsers(actor, options: QueryOptions)` returning `{ items, totalItems }` (pure delegation to the repository; no query-string awareness).
  - `src/modules/users/user.repository.ts` — add `findUsers(options: QueryOptions)` using the shared `prisma-query-mapper` for `skip`/`take`/`orderBy`/`where`, plus a matching `count`.
  - `src/modules/users/user.controller.ts` — register `GET /` behind `requireAuthenticationMiddleware` and the authorization guard for `workspace.listUsers`; call `IQueryParser.parse(req.query, usersQueryConfig)`, invoke the service, build `meta.pagination` via `buildPaginationMeta`, respond `{ data, meta: { pagination } }`.
  - `src/modules/users/user.schema.ts` / `user.types.ts` — declare `usersQueryConfig` (sortable fields, filterable fields with per-field Zod value schemas and permitted operators, page-size defaults/max) and the list-item DTO (safe fields only).
  - `src/modules/users/user.interface.ts` — extend `IUserService` and `IUserRepository` with the new methods.
  - `src/modules/users/index.ts` — DI wiring for the query parser and config into the controller.
  - `src/common/authorization/authorization-matrix.ts` — add `listUsers: [OWNER, ADMIN, DEVELOPER]` under the `workspace` scope.
- **Database**: no schema or migration changes. Reuses the existing `users` table.
- **Consumes**: `@/common/query` (`IQueryParser`, `buildPaginationMeta`, `prismaQueryMapper`, `QueryConfig`, `QueryOptions`), `@/common/authorization` (`AuthorizationGuard`, matrix), `@/common/middlewares` (`requireAuthenticationMiddleware`), typed errors in `@/common/errors` (via `map-zod-error` / `map-prisma-error`).
- **API**: implements `docs/04-api/api-design.md` §4.2 `GET /users` (200/401/403/500), §5 (Query Parameter Conventions), and §6.2 (collection envelope with `meta.pagination`). No breaking changes to existing routes.
- **Tests**:
  - **Unit**: only for `UserService.listUsers`, and only if it holds non-trivial behavior worth isolating (e.g., branching, mapping, or error translation). If the service is a thin pass-through to the repository, skip unit tests and rely on the integration suite. No unit tests for the controller or the repository.
  - **Integration**: full coverage for `GET /api/v1/users` — pagination defaults, `pageSize` cap, sort with `-` prefix, each supported filter operator (including `in`), the `{ data, meta: { pagination } }` envelope shape, exclusion of credential/activation-token fields from list items, 401 without auth, 403 for actors lacking `listUsers`, and 400 for invalid query parameters.
- **Dependencies**: none new.
