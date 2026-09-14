## 1. Authorization matrix

- [ ] 1.1 Add `listUsers` to `AuthorizationAction` in `src/common/authorization/authorization.types.ts` and to the `workspace` scope in `src/common/authorization/authorization-matrix.ts` with allowed roles `[OWNER, ADMIN, DEVELOPER]` (design D4/D9, proposal Impact). Verify `tsc --noEmit -p tsconfig.json` and a targeted `AuthorizationGuard` unit test asserts each of Owner/Admin/Developer passes `authorize({ scope: workspace, action: 'listUsers' })` and every other workspace role is denied with `AuthorizationError`.

## 2. Users query config

- [ ] 2.1 Create `server/src/modules/users/user.query-config.ts` exporting `usersQueryConfig: QueryConfig` with `sortableFields = ['name', 'email', 'createdAt', 'updatedAt']`, `defaultPageSize = 10`, `maxPageSize = 100`, and the filterable-field table from design D3 (`name`/`email`/`workspaceRoleId`/`status` → `eq|ne|in`, `createdAt`/`updatedAt` → `eq|gt|gte|lt|lte`) with per-field Zod value schemas (`z.string().min(1)`, `z.email()`, `z.uuid()`, `z.nativeEnum(UserStatus)`, `z.coerce.date()`) (design D1/D3). Verify `tsc --noEmit -p tsconfig.json` succeeds; the config's runtime behavior is exercised by the integration tests in task 8, not by dedicated unit tests.
- [ ] 2.2 Re-export `usersQueryConfig` from `src/modules/users/index.ts` alongside the existing module exports (design D1).

## 3. Interfaces and types

- [ ] 3.1 Add `ListUsersResult = { items: User[]; totalItems: number }` to `src/modules/users/user.types.ts` (design D4/D5, reusing the module's single `User` shape). Verify `tsc --noEmit -p tsconfig.json` succeeds.
- [ ] 3.2 Extend `IUserRepository` in `src/modules/users/user.interface.ts` with `findUsers(options: QueryOptions): Promise<ListUsersResult>` and `IUserService` with `listUsers(actor: ActorContext, options: QueryOptions): Promise<ListUsersResult>` (design D4/D5). Verify `tsc --noEmit -p tsconfig.json` succeeds and existing implementations flag as incomplete until tasks 4.1 and 5.1 land.

## 4. Repository

- [ ] 4.1 Implement `UserRepository.findUsers(options)` in `src/modules/users/user.repository.ts` (design D5/D6): derive `{ skip, take, orderBy, where }` with `toPrismaFindArgs(options)`, append `{ id: 'asc' }` as a trailing `orderBy` tiebreaker, run `findMany` (reusing the existing private `select`) and `count` inside a single `this.prisma.$transaction([...])`, parse each row through `UserSchema`, and route errors through `mapPrismaError` / `logError`. Verify `tsc --noEmit -p tsconfig.json` succeeds and rely on the integration tests in task 8 to exercise the behavior end to end (no dedicated repository tests).

## 5. Service

- [ ] 5.1 Implement `UserService.listUsers(actor, options)` in `src/modules/users/user.service.ts` (design D4): call `this.authorizationGuard.authorize({ actor, scope: AuthorizationScope.Workspace, action: 'listUsers' })`, then delegate to `this.userRepository.findUsers(options)` and return its result unchanged. Verify unit tests (mocked collaborators) cover: unauthorized actor → `AuthorizationError` and the repository is not called; authorized actor → repository is called exactly once with the same `options` reference (no mutation) and its result is returned as-is.

## 6. Controller and routing

- [ ] 6.1 Update `UsersController` in `src/modules/users/user.controller.ts` to accept `queryParser: IQueryParser` and `usersQueryConfig: QueryConfig` via the constructor, and register `this.router.get('/', requireAuthenticationMiddleware, this.listUsers.bind(this))` in `registerRoutes()` (design D7/D8). Verify `tsc --noEmit -p tsconfig.json` succeeds and the existing DI callsites flag as incomplete until task 7.1 lands.
- [ ] 6.2 Implement the private `listUsers(req, res, next)` handler on `UsersController` (design D7): parse `req.query` via `this.queryParser.parse(req.query, this.usersQueryConfig)`, call `this.userService.listUsers(req.actor as ActorContext, options)`, build meta via `buildPaginationMeta(options.pagination.page, options.pagination.pageSize, totalItems)`, and respond `200` with `{ data: items, meta: { pagination } }`; on error forward via `next(error)`. Verify the integration tests in task 8 exercise the envelope shape end to end.

## 7. Dependency injection

- [ ] 7.1 In `src/modules/users/index.ts`, import `queryParser` from `@/common/query` and `usersQueryConfig` from `./user.query-config`, and pass them to `new UsersController(userService, queryParser, usersQueryConfig)` (design D8). Verify `npm run build` succeeds and the server starts (`node dist/server.js` or the existing start command) without runtime errors.
- [ ] 7.2 Update `server/tests/integration/modules/users/users.controller.fixtures.ts` to construct `UsersController` with the same three collaborators (using the shared `queryParser` singleton and `usersQueryConfig`) so the test app mirrors production wiring. Verify existing `POST /` and `GET /me` integration cases still pass under `npm run test:integration`.

## 8. Integration tests for GET /api/v1/users

> All happy-path scenarios are added first (8.1–8.4) so a green run confirms the endpoint works end to end; error and rejection paths follow in 8.5–8.7.

- [ ] 8.1 Add a `describe('GET /', ...)` block to `server/tests/integration/modules/users/users.controller.test.ts` covering the envelope happy path (spec §"Collection response envelope"): an authorized Owner request returns `200` with `data: User[]` and `meta.pagination = { page, pageSize, totalItems, totalPages }`; assert `totalPages = ceil(totalItems / pageSize)` and, for a `pageSize = 10` set of 25 seeded users, `totalItems === 25` and `totalPages === 3`; assert the empty-match case returns `data: []`, `totalItems === 0`, `totalPages === 0`. Verify with `npm run test:integration`.
- [ ] 8.2 Add authorized-role happy cases (spec §"Authorized user listing"): Owner, Admin, and Developer each receive `200` with a valid envelope. Verify with `npm run test:integration`.
- [ ] 8.3 Add query-contract happy cases (spec §"Query-parameter contract"): `sort=-createdAt` returns rows ordered by `createdAt` descending; `filter[status]=Pending` returns only pending users; `filter[workspaceRoleId][in]=<a>,<b>` returns only users whose role id is `a` or `b`; `filter[createdAt][gte]=<ISO>` returns only users at or after that instant; omitting `page`/`pageSize` defaults to `page=1`, `pageSize=10`. Verify with `npm run test:integration`.
- [ ] 8.4 Add the safe-fields happy-path assertion (spec §"Safe fields only in user list items"): iterate the response `data` and assert every item exposes exactly `id`, `name`, `email`, `workspaceRoleId`, `status`, `createdAt`, `updatedAt` and none of `password`, `activationTokenHash`, `activationTokenExpiresAt`. Verify with `npm run test:integration`.
- [ ] 8.5 Add authorization-failure cases: an actor whose workspace role is not in `listUsers` (seed or spy the actor context to a non-matrix role) receives `403` via `expectForbiddenError`; an unauthenticated request receives `401` via `expectAuthenticationRequired`. Verify with `npm run test:integration`.
- [ ] 8.6 Add query-validation failure cases (spec §"Query-parameter contract" rejection scenarios): each of `sort=disallowed`, `filter[unknownField]=x`, `filter[status][gt]=x` (operator not permitted), `pageSize=101` (above cap), and `filter[workspaceRoleId]=not-a-uuid` returns `400` via `expectValidationError` naming the offending client-facing key (`sort`, `filter[unknownField]`, `filter[status]`, `pageSize`, `filter[workspaceRoleId]`). Verify with `npm run test:integration`.
- [ ] 8.7 Add a dependency-failure case: `jest.spyOn(ctx.userRepository, 'findUsers').mockRejectedValue(new Error('database unavailable'))` produces a `500` via `expectInternalServerError`. Verify with `npm run test:integration`.

## 9. Verification

- [ ] 9.1 Run `npm run prettier`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, and `npm run build` — all pass.
- [ ] 9.2 Run `openspec validate add-users-list-route --strict` and confirm the change is valid.
