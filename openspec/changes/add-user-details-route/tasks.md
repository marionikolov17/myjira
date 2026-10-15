## 1. Authorization matrix

- [ ] 1.1 Add `'getUserById'` to the `AuthorizationAction` union in `server/src/common/authorization/authorization.types.ts` and add `getUserById: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN, WorkspaceRoleName.DEVELOPER]` to the `workspace` scope in `server/src/common/authorization/authorization-matrix.ts` (design D3). Verify `npx tsc --noEmit -p tsconfig.json` succeeds and the existing `AuthorizationGuard` unit suite still passes (`npm run test:unit`); confirm by reading the matrix file that `getUserById` lists exactly `OWNER`, `ADMIN`, and `DEVELOPER` under the `workspace` scope.

## 2. Service interface

- [ ] 2.1 Extend `IUserService` in `server/src/modules/users/user.interface.ts` with `getUserById(actor: ActorContext, userId: string): Promise<User>` (design D2). Verify `npx tsc --noEmit -p tsconfig.json` succeeds and the existing `UserService` implementation flags as incomplete until task 3.1 lands.

## 3. Service implementation

- [ ] 3.1 Implement `UserService.getUserById(actor, userId)` in `server/src/modules/users/user.service.ts` (design D2): call `this.authorizationGuard.authorize({ actor, scope: AuthorizationScope.Workspace, action: 'getUserById' })`; then `this.userRepository.getUserById(userId)`; if the result is `null`, log a warn like `'Workspace user retrieval rejected: target user not found'` with `{ userId }` and throw `new ResourceNotFoundError({ resourceName: this.userRepository.resourceName })`; otherwise return the user unchanged. Place the method next to `updateUserRole` (same ordering convention as the rest of the class). Verify `npm run build` succeeds and the controller wiring compiles. Service-level unit tests are intentionally omitted — the method is a thin `authorize → getUserById → null-to-404` pass-through with no branching worth isolating; coverage is provided end-to-end by the integration tests in §6.

## 4. Controller and routing

- [ ] 4.1 In `server/src/modules/users/user.controller.ts`, add a private `getUserById(req, res, next)` handler (design D4): `const { id } = IdSchema.parse(req.params)`; `const user = await this.userService.getUserById(req.actor as ActorContext, id)`; `res.status(200).json({ data: user })`; on error forward via `next(error)`. Place the handler next to `updateUserRole` (same ordering convention). Register the route in `registerRoutes()` as `this.router.get('/:id', requireAuthenticationMiddleware, this.getUserById.bind(this))`, added **after** the existing `GET /me`, `POST /`, and `PATCH /:id/role` registrations so the dedicated `GET /me` route continues to take precedence over the parameterized `GET /:id` (design D4 route-ordering caveat). Verify `npm run build` succeeds.

## 5. Dependency wiring

- [ ] 5.1 Review `server/src/modules/users/index.ts` and confirm no new injected dependencies are required (the `UserService` already has `authorizationGuard` and `userRepository`, and `UsersController` already receives `IUserService`); if any wiring IS missing after §3 or §4, update `index.ts`. Verify by running `npm run build` and starting the server (`npm run dev` is sufficient — no runtime regression on existing routes).

## 6. Integration tests for GET /api/v1/users/:id

> All happy-path scenarios are added first (6.1–6.2) so a green run confirms the endpoint works end to end; error and rejection paths follow in 6.3–6.7, ordered by HTTP status code.

- [ ] 6.1 Add a `describe('GET /:id', ...)` block to `server/tests/integration/modules/users/users.controller.test.ts` covering the role-matrix happy path together with the single-resource envelope (spec §"Authorized workspace user retrieval by id" + §"Single-resource response envelope for user retrieval"): for each of Owner, Admin, and Developer, a request for the same existing target user returns `200` with `{ data: user }` where `data.id` matches the requested path id and `data` carries `id`, `name`, `email`, `workspaceRoleId`, `status`, `createdAt`, `updatedAt`. **Before writing**, `Read` `.cursor/rules/backend/integration-tests-pattern.mdc` into context and extend `users.controller.fixtures.ts` / `users.controller.assertions.ts` with any helpers needed to build the request and assert the single-resource envelope. Verify with `npm run test:integration`.
- [ ] 6.2 Add the safe-fields happy-path assertion (spec §"Safe fields only in retrieved user"): for one authorized actor requesting an existing user, assert the response `data` object's keys are exactly `['id', 'name', 'email', 'workspaceRoleId', 'status', 'createdAt', 'updatedAt']` (set-equality) and none of `password`, `activationTokenHash`, `activationTokenExpiresAt` are present. Verify with `npm run test:integration`.
- [ ] 6.3 Add the 400 validation case (spec §"Path identifier must be a well-formed user id"): a request to `/api/v1/users/not-a-uuid` by an authorized actor returns `400` via `expectValidationError` naming the offending `id` parameter. Verify with `npm run test:integration`.
- [ ] 6.4 Add the 401 authentication case: an unauthenticated request to `/api/v1/users/<valid-uuid>` returns `401` via `expectAuthenticationRequired`. Verify with `npm run test:integration`.
- [ ] 6.5 Add 403 authorization-failure cases: an actor whose workspace role is not in the `getUserById` matrix (seed or spy the actor context to a non-matrix role) receives `403` via `expectForbiddenError`; assert the repository's `getUserById` is NOT invoked (spy on `ctx.userRepository.getUserById`). Verify with `npm run test:integration`.
- [ ] 6.6 Add the 404 not-found case (spec §"Unknown target user yields not-found"): an authorized request for a well-formed but unknown UUID returns `404` via `expectResourceNotFoundError`. Verify with `npm run test:integration`.
- [ ] 6.7 Add a 500 dependency-failure case: `jest.spyOn(ctx.userRepository, 'getUserById').mockRejectedValue(new Error('database unavailable'))` for an authorized request produces `500` via `expectInternalServerError`. Verify with `npm run test:integration`.

## 7. API documentation

- [ ] 7.1 Add `GET /users/{id}` to `server/docs/openapi.json`: path parameter `id` (`uuid`), `security: [{ bearerAuth: [] }]`, tag `Users`, response `200` referencing the existing safe-fields user schema wrapped in a `{ data: ... }` envelope, and documented `400` / `401` / `403` / `404` / `500` responses using the shared error-response schemas already referenced by `/users/{id}/role`. Match the style and examples density of the sibling `/users/{id}/role` entry. Verify by starting the dev server (`npm run dev`) and opening `/docs` to confirm the new endpoint renders and the request/response examples are valid.

## 8. Final verification

- [ ] 8.1 Run `npm run prettier` and `npm run lint` and verify both complete cleanly.
- [ ] 8.2 Run `npm run test` (unit + integration) and verify the full suite passes with the new cases included.
- [ ] 8.3 Run `openspec validate add-user-details-route --strict` and verify the change is valid.
