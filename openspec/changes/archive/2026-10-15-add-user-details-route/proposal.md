## Why

`docs/04-api/api-design.md` §4.2 lists `GET /users/{id}` as part of the users API surface, but the user-management capability does not implement it today. It currently supports creation (`POST /users`), listing (`GET /users`), self-read (`GET /users/me`), and role update (`PATCH /users/{id}/role`) — there is no way for an authenticated workspace member to fetch a single user's profile by id. Every downstream feature that needs to show a user (issue assignee, project member card, mention preview, admin detail view) has to piggyback on the list endpoint and client-filter, which is wasteful and does not scale to deep-links. Adding `GET /users/{id}` closes the last gap in the per-resource read surface and gives downstream features a direct, authorized profile read that returns the same safe-fields shape every other user read already produces.

## What Changes

- Add a `UserService.getUserById(actor, userId)` use case that enforces workspace-member authorization and returns the single workspace user resource, or raises `ResourceNotFoundError` when no user matches the id.
- Expose `GET /api/v1/users/:id` (authenticated) in the users controller. The controller validates the path parameter with the shared `IdSchema` (UUID), calls the service, and returns `{ data: user }` with `200 OK` — matching `docs/04-api/api-design.md` §4.2 and §6.1.
- Enforce authorization via the existing `AuthorizationGuard` on the `workspace` scope with a new `getUserById` action. Allowed roles: **Workspace Owner, Workspace Admin, and Developer** — every authenticated workspace member needs to resolve a user by id to support the downstream read features listed above; this mirrors the role set already granted to `listUsers`.
- Reuse the existing `UserRepository.getUserById(userId)` method unchanged — it already selects the module's single safe-fields `select` (`id`, `name`, `email`, `workspaceRoleId`, `status`, `createdAt`, `updatedAt`) and parses through `UserSchema`, so password, password-hash, activation-token, activation-token-hash, and activation-token-expiry are structurally impossible to leak.
- Add `getUserById` to `AuthorizationAction` in `src/common/authorization/authorization.types.ts` and to the `workspace` scope in `src/common/authorization/authorization-matrix.ts` with `[OWNER, ADMIN, DEVELOPER]`.
- Document the new route in `server/docs/openapi.json` reusing the existing safe-fields user response schema.

## Capabilities

### New Capabilities

<!-- None. The route extends an existing capability rather than introducing a new one. -->

### Modified Capabilities

- `user-management`: add requirements for authorized retrieval of a single workspace user by id — who may read (Owner, Admin, Developer via a new `getUserById` matrix entry under the `workspace` scope), the resource-not-found behavior when the id does not match any user, the single-resource response envelope shape, and the guarantee that no credential, password, or activation-token fields are ever exposed on the returned resource.

## Impact

- **Code (server)**:
  - `src/common/authorization/authorization.types.ts` — add `'getUserById'` to the `AuthorizationAction` union.
  - `src/common/authorization/authorization-matrix.ts` — add `getUserById: [OWNER, ADMIN, DEVELOPER]` under the `workspace` scope.
  - `src/modules/users/user.interface.ts` — extend `IUserService` with `getUserById(actor: ActorContext, userId: string): Promise<User>`.
  - `src/modules/users/user.service.ts` — implement `getUserById` (authorize → `userRepository.getUserById` → `ResourceNotFoundError` on `null` → return the user).
  - `src/modules/users/user.controller.ts` — register `this.router.get('/:id', requireAuthenticationMiddleware, this.getUserById.bind(this))` in `registerRoutes()` and add the handler (validate `req.params` with `IdSchema`, call the service, respond `{ data: user }`).
- **Repository**: no new method. `UserRepository.getUserById(userId)` already exists and already returns the safe fields.
- **Database**: no schema or migration changes.
- **Dependency wiring**: no new injected dependencies — `UsersController` already receives `IUserService`; `UserService` already has `authorizationGuard` and `userRepository`.
- **Consumes**: `@/common/authorization` (`AuthorizationGuard`, `AuthorizationScope.Workspace`, matrix), `@/common/middlewares` (`requireAuthenticationMiddleware`), `@/common/schema` (`IdSchema`), typed errors in `@/common/errors` (`ResourceNotFoundError`, `AuthenticationError`, `AuthorizationError`).
- **API**: implements `docs/04-api/api-design.md` §4.2 `GET /users/{id}` (200/401/403/404/500) and §6.1 (single-resource envelope). No breaking changes to existing routes.
- **Tests**:
  - **Unit**: none. `UserService.getUserById` is a thin `authorize → userRepository.getUserById → null-to-404` pass-through with no branching worth isolating; the behavior is fully covered end-to-end by the integration tests below. The controller and repository are also not unit-tested here (the controller is covered by integration tests; the repository method already exists and is exercised by other callers).
  - **Integration**: full coverage for `GET /api/v1/users/:id` — Owner/Admin/Developer each receive `200` with `{ data: user }` for the same existing user (combined role-matrix + envelope case); the response body exposes exactly the safe fields and none of `password`, `activationTokenHash`, `activationTokenExpiresAt`; non-UUID `:id` returns `400` via `expectValidationError`; unauthenticated request returns `401` via `expectAuthenticationRequired`; actor whose workspace role is not in `getUserById` returns `403` via `expectForbiddenError`; unknown-but-well-formed UUID returns `404` via `expectResourceNotFoundError`; a dependency failure spied on `userRepository.getUserById` produces `500` via `expectInternalServerError`.
- **OpenAPI**: add `GET /users/{id}` to `server/docs/openapi.json` with the `:id` path parameter (`uuid`), the existing safe-fields user response schema, and documented `400`/`401`/`403`/`404`/`500` responses.
- **Dependencies**: none new.
