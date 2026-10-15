## Context

See `proposal.md` — Why, and `specs/user-management/spec.md` for the behavior contract added by this change. This design covers the server-side `GET /api/v1/users/:id` route, which is the smallest possible read endpoint: a single-row lookup by id against an already-safe repository method, gated by the same authorization pattern as the other users-module reads.

Relevant current state and constraints:

- **Layering / DI**: controller → service → repository, collaborators injected via constructor and wired in `src/modules/users/index.ts`. Business logic in the service, persistence in the repository, path/body validation in the controller (see `server/AGENTS.md`).
- **Users repository** already exposes `getUserById(userId: string): Promise<User | null>` that selects the module's single safe-fields `select` (`id`, `name`, `email`, `workspaceRoleId`, `status`, `createdAt`, `updatedAt`) and parses rows through the single `UserSchema`. Credential and activation-token columns are never selected. The same method already backs `UserService.updateUserRole`.
- **Authorization**: `AuthorizationGuard.authorize({ actor, scope, action })` is the single enforcement point; matrix in `common/authorization/authorization-matrix.ts`. No `getUserById` entry exists yet. The matrix already grants `listUsers` to `[OWNER, ADMIN, DEVELOPER]`.
- **Users response schema**: a single `UserSchema` covers all safe fields including `status`. No separate detail/list variants exist — every persistence method returns this shape.
- **Path-param validation**: the shared `IdSchema` (`z.object({ id: z.uuid() })`) is already used by `PATCH /users/:id/role` to validate `req.params`.
- **API design**: `GET /users/{id}` returns 200/401/403/404/500 (`docs/04-api/api-design.md` §4.2). Single-resource envelope shape is §6.1.
- **OpenAPI**: `server/docs/openapi.json` already documents `/users/me`, `/users` (POST, GET), and `/users/{id}/role`; adding another path there is purely additive.

## Goals / Non-Goals

**Goals:**

- Introduce `GET /api/v1/users/:id` as a thin, authorized read that reuses the existing repository method and the module's single safe-fields `select` + `UserSchema`, so no new persistence code paths are introduced.
- Keep concerns split cleanly across the three layers: the controller owns transport + path validation; the service owns authorization + resource-not-found translation; the repository owns persistence.
- Guarantee the response body is provably free of credential/activation-token data by construction, not by ad-hoc field filtering.
- Keep the authorization decision driven by the matrix (one-line change), consistent with how `listUsers` and `updateUserRole` are gated today.

**Non-Goals (design-level boundaries beyond proposal Out of Scope):**

- No new repository method, no new `select`, no new user response shape, no new DTO.
- No cross-workspace lookup semantics or per-field redaction based on actor role — every allowed role sees the same safe-fields payload.
- No prefetching, caching, or batched read; this route resolves exactly one id per request.
- No modifications to `GET /users/me`, `GET /users`, or `PATCH /users/{id}/role`.

## Decisions

### D1. Reuse `UserRepository.getUserById` unchanged

The service calls the existing `userRepository.getUserById(userId)`; no new repository method is introduced.

- **Why:** `getUserById` already uses the module's single private `select` (safe fields only) and parses through `UserSchema`, which is the exact shape this route must return. Adding a parallel `findUserById` / `getUserDetailsById` would duplicate code and reintroduce the risk of two methods drifting apart on which columns they select.
- **Alternative considered:** Add a dedicated `getUserForDetailsRoute` method with its own `select`. Rejected — it would fragment the module's canonical user shape, inflate the surface the next reviewer has to audit for credential leaks, and buy nothing: this route needs exactly what `getUserById` already returns.

### D2. Service enforces authorization and translates `null → ResourceNotFoundError`

```ts
// user.service.ts (added)
public async getUserById(actor: ActorContext, userId: string): Promise<User> {
  this.authorizationGuard.authorize({
    actor,
    scope: AuthorizationScope.Workspace,
    action: 'getUserById',
  });

  const user = await this.userRepository.getUserById(userId);

  if (!user) {
    throw new ResourceNotFoundError({ resourceName: this.userRepository.resourceName });
  }

  return user;
}
```

The order is: **authorize → load → not-found translation → return.**

- **Why:** Matches the exact pattern already used by `UserService.updateUserRole` (authorize, then `getUserById`, then `ResourceNotFoundError` on `null`). Placing authorization first ensures an unprivileged caller cannot probe for the existence of a user by observing 403-vs-404; both signals share the same gate. Translating the repository's `null` into `ResourceNotFoundError` keeps the controller free of persistence-shape awareness and keeps `getUserById`'s nullable return intact for the few callers (`updateUserRole`) that need to distinguish presence programmatically.
- **Alternative considered:** Return `User | null` from the service and let the controller 404. Rejected — it would push a persistence detail (nullable) into the transport layer, duplicate the 404 translation for every caller added later, and break the module's convention that controllers only shape successful envelopes while services own error throwing.
- **Alternative considered:** Load first, then authorize. Rejected — a non-privileged caller submitting a known-good id would consume a DB query before being rejected, and the response code would still need to be 403 for consistency with the other users-module reads.

### D3. Allowed roles: `[OWNER, ADMIN, DEVELOPER]`

The authorization matrix gets `workspace.getUserById: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN, WorkspaceRoleName.DEVELOPER]`.

- **Why:** The proposal's downstream use cases (issue-assignee cards, project-member panels, mention previews, admin detail views) are hit by every authenticated workspace member — mirroring the role set already granted to `listUsers`, which was chosen for the same reason. Any resource that is already visible in the list has to be fetchable one-by-one; a stricter role set here would force clients to fall back to the list endpoint for the same information, which is strictly worse for traffic and for permission auditability (the data is already discoverable).
- **Alternative considered:** Owner/Admin only. Rejected — would silently break any UI that drops a `/users/:id` link into a Developer's view (every ticket detail page) and would diverge from `listUsers` for no security gain.
- **Alternative considered:** Add a project-scope variant that limits visibility to project members. Rejected — the proposal narrows this change to a workspace-wide read, matching the current list behavior; project-scoped user visibility is a separate capability and would belong in `project-members`, not here.

### D4. Controller composition

```ts
// user.controller.ts (added)
private async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = IdSchema.parse(req.params);
    const user = await this.userService.getUserById(req.actor as ActorContext, id);
    res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
}
```

Route registration adds `this.router.get('/:id', requireAuthenticationMiddleware, this.getUserById.bind(this))` in `registerRoutes()`.

- **Why:** Matches the existing controller shape (see `updateUserRole`, which already uses `IdSchema.parse(req.params)`). The controller does not inspect the body (there is no body on a GET), does not touch persistence, and forwards all errors through `next(error)` so `errorMiddleware` renders them.
- **Route-ordering caveat:** Express matches routes in registration order. The existing `GET /me` route is registered before any new `GET /:id`, so an incoming `GET /me` continues to match the dedicated handler and never falls through to the parameterized route. The task list keeps the registration order (`GET /` → `GET /me` → `POST /` → `PATCH /:id/role` → add `GET /:id` last) so this invariant stays obvious and no reader is tempted to reorder them.

### D5. Path validation uses the shared `IdSchema`

The controller parses `req.params` with the shared `IdSchema` (which validates `id` as a UUID). Any non-UUID id surfaces a Zod `ValidationError` via `errorMiddleware` as 400.

- **Why:** The project's single canonical path-id schema; already used by `PATCH /users/:id/role` and consistent with `User.id` being a UUID in Prisma. Reusing it means a malformed id is rejected before authorization runs — which the spec explicitly requires — and reviewers see one familiar validation shape across routes.
- **Alternative considered:** Inline `z.uuid().parse(req.params.id)`. Rejected — functionally equivalent but inconsistent with the sibling route and would need a parallel justification whenever `IdSchema` evolves (e.g., if ids ever change format).

### D6. DI wiring

No new injected dependencies. `UsersController` already receives `IUserService`; `UserService` already receives `authorizationGuard` and `userRepository`. The change is purely additive to existing classes.

### D7. Error mapping (per `docs/04-api/api-design.md` §4.2)

| Client scenario                                         | Error thrown                                                | Status |
| ------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| No / invalid auth token                                 | `AuthenticationError` (middleware)                          | 401    |
| Non-UUID `:id`                                          | `ValidationError` (`IdSchema.parse` in the controller)      | 400    |
| Actor's workspace role not in `getUserById` matrix      | `AuthorizationError` (guard)                                | 403    |
| Well-formed `:id` with no matching user                 | `ResourceNotFoundError` (service, resource = `'users'`)     | 404    |
| Unexpected Prisma / infrastructure failure              | `mapPrismaError` → `AppError` (bubbled from the repository) | 500    |

- **Why:** All five branches already have first-class errors in `@/common/errors`; there is nothing new to invent. 400 is not in the API-design doc's listed responses but is unavoidable for a path-param GET (clients can send `/users/abc`); the shared validation shape via `errorMiddleware` is already how every other route handles that case, and the taxonomy is consistent with the OpenAPI additions for the new route.
- **Why 404-not-403 for unknown ids:** The caller is already an authenticated workspace member authorized to call this action — there is no information to hide. Returning 404 lets clients distinguish deleted/typoed ids from permission denials and matches the sibling `PATCH /users/:id/role`, which already returns 404 on an unknown target.

## Risks / Trade-offs

- **[Granting `getUserById` to Developer effectively opens single-user reads to every authenticated workspace member]** Any leakage risk from reading one user by id is bounded by D1's reuse of the safe-fields `select` and D2's reuse of `UserSchema`. → **Mitigation:** if a future policy tightens single-user reads to Owner/Admin only (or to a project-member scope), the change is a one-line matrix edit — exactly the same shape as the `listUsers` entry today.
- **[Enumeration of valid user ids]** An authorized actor can walk ids to learn which users exist in the workspace. → **Accepted:** every authorized actor can already enumerate users via `GET /users` (same role set), so this route reveals nothing new. The ids are UUIDs, so blind enumeration from outside the workspace is infeasible even before authorization.
- **[Route-ordering drift between `GET /me` and `GET /:id`]** If `GET /:id` were ever registered before `GET /me`, Express would route `GET /me` into the parameterized handler and `IdSchema.parse` would reject `"me"` as a non-UUID (returning 400 instead of the current actor). → **Mitigation:** D4 keeps the registration order deliberate; integration tests exercise `GET /me` after this change ships and would catch a regression immediately.
- **[Reusing `getUserById` couples `updateUserRole` and this route to the same persistence call]** A future change that alters `getUserById`'s selected columns would affect both routes. → **Accepted and desired:** the whole point of D1 is to keep the module on one canonical user shape; coupling two safe-field reads to the same `select` is a feature, not a bug.

## Migration Plan

Additive change, no data migration required.

- **Deploy order:** ship the `getUserById` authorization action, matrix entry, service method, controller route, and OpenAPI entry in the same release. The route path did not exist before, so partial rollout cannot leave clients in an inconsistent state.
- **Rollback:** remove the route from `registerRoutes()`, the service method, the matrix entry, the `AuthorizationAction` union member, and the OpenAPI entry. No persistent state is introduced by this change, so rollback is a pure code revert.
