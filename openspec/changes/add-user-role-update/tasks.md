## 1. Correct the authorization matrix

- [x] 1.1 Change `updateUserRole` in `server/src/common/authorization/authorization-matrix.ts` from `[WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN]` to `[WorkspaceRoleName.OWNER]` and verify by reading the file that only `OWNER` is listed for that action.

## 2. Request schema and types

- [x] 2.1 Add `UpdateUserRoleRequestParamsSchema` (strict object with `workspaceRoleId: z.uuid()`) and the inferred `UpdateUserRoleRequestParams` type to `server/src/modules/users/user.schema.ts`, and verify by importing both from the module in a REPL or by running `npm run build`.
- [x] 2.2 Add an `UpdateUserRoleResult` type alias (equal to `User`) to `server/src/modules/users/user.types.ts` for parity with other service result types; verify by running `npm run build`.

## 3. Repository: update workspace role by id

- [x] 3.1 Extend `IUserRepository` in `server/src/modules/users/user.interface.ts` with `updateUserWorkspaceRoleById(userId: string, workspaceRoleId: string): Promise<User>`, returning the updated row via the existing safe-fields `select`; verify by running `npm run build`.
- [x] 3.2 Implement `updateUserWorkspaceRoleById` in `server/src/modules/users/user.repository.ts` using `prisma.user.update({ where: { id }, data: { workspaceRoleId }, select: this.select })`, with the same `try/catch` + `logError` + `mapPrismaError` pattern used by sibling methods; verify by running `npm run build`.
- [x] 3.3 Update `server/tests/unit/modules/users/user.service.mock.ts` and `server/tests/unit/mocks/user.repository.mock.ts` so `IUserRepository` mocks expose `updateUserWorkspaceRoleById`; verify `npm run test:unit` still passes.

## 4. Service: `updateUserRole`

- [x] 4.1 Extend `IUserService` in `server/src/modules/users/user.interface.ts` with `updateUserRole(actor: ActorContext, userId: string, params: UpdateUserRoleRequestParams): Promise<User>`; verify `npm run build`.
- [x] 4.2 Implement `UserService.updateUserRole` in `server/src/modules/users/user.service.ts` with the following order:
      (a) `authorizationGuard.authorize({ actor, scope: Workspace, action: 'updateUserRole' })`;
      (b) load target via `userRepository.getUserById(userId)`, throw `ResourceNotFoundError` if null;
      (c) load the target's current workspace role via `workspaceRoleRepository.getWorkspaceRoleById(target.workspaceRoleId)` and throw `AuthorizationError` ("forbidden") if its name is `WorkspaceRoleName.OWNER`;
      (d) call the existing `assertAssignableRole(params.workspaceRoleId)` to reject unknown or Owner requested roles with `BusinessRuleViolationError`;
      (e) if `target.workspaceRoleId === params.workspaceRoleId`, log and return `target` unchanged (idempotent no-op);
      (f) otherwise return `userRepository.updateUserWorkspaceRoleById(target.id, params.workspaceRoleId)`.
      Verify `npm run build`.
- [x] 4.3 Add unit tests in `server/tests/unit/modules/users/user.service.test.ts` covering every service-level scenario. Order them so happy paths come first, then error paths:
      **Happy paths:**
      Owner performs Dev → Admin (updated user returned);
      Owner performs Admin → Dev (updated user returned);
      same-role request → no repository `update*` call made, service returns the target unchanged;
      non-activated target succeeds the same way as an activated one.
      **Error paths:**
      non-permitted actor is rejected via the authorization guard mock;
      unknown target id → `ResourceNotFoundError`;
      target whose current role is Owner → `AuthorizationError`;
      requested `workspaceRoleId` references an unknown role → `BusinessRuleViolationError`;
      requested `workspaceRoleId` references the Workspace Owner role → `BusinessRuleViolationError`.
      Missing-field validation is not a service responsibility (the schema parse lives in the controller) and is covered by the §6 integration tests.
      Verify with `npm run test:unit`.

## 5. Controller: `PATCH /users/:id/role`

- [x] 5.1 In `server/src/modules/users/user.controller.ts`, register `this.router.patch('/:id/role', requireAuthenticationMiddleware, this.updateUserRole.bind(this));` and implement `updateUserRole(req, res, next)` that:
      guards the body with `isPlainObject`;
      parses the body with `UpdateUserRoleRequestParamsSchema`;
      validates `req.params.id` as a UUID (inline `z.uuid().parse(req.params.id)`), letting a bad id surface a Zod validation error through `errorMiddleware`;
      calls `this.userService.updateUserRole(req.actor as ActorContext, id, validated)`;
      responds `res.status(200).json({ data: user })`.
      Controller logic is exercised by the §6 integration tests on this route — no controller unit tests are added. Verify by running `npm run build`.

## 6. Integration tests

- [x] 6.1 Add new fixtures in `server/tests/integration/modules/users/users.controller.fixtures.ts` (and assertions in `users.controller.assertions.ts`) as needed for `updateUserRole` requests and expected responses; verify by referencing them from the new test and running `npm run test:integration`.
- [x] 6.2 Add integration tests in `server/tests/integration/modules/users/users.controller.test.ts` covering end-to-end every requirement scenario in `openspec/changes/add-user-role-update/specs/user-management/spec.md`. Order the cases so all happy paths come first, then error paths ordered by HTTP status code (400 → 401 → 403 → 404 → 422):
      **Happy paths (200):**
      Owner Dev → Admin returns the updated resource;
      Owner Admin → Dev returns the updated resource;
      same-role request returns the unchanged resource (idempotent no-op);
      non-activated target succeeds the same way as an activated one;
      response body never includes `password`, `activationTokenHash`, or `activationTokenExpiresAt` on any of the above successes.
      **Error paths (ordered by status code):**
      400 — missing `workspaceRoleId` → validation;
      401 — unauthenticated → authentication-required;
      403 — Admin actor → forbidden;
      403 — Developer actor → forbidden;
      403 — target currently Owner → forbidden;
      404 — unknown target id → not-found;
      422 — unknown `workspaceRoleId` → business-rule;
      422 — `workspaceRoleId` references the Workspace Owner role → business-rule.
      Verify with `npm run test:integration`.

## 7. Dependency wiring

- [x] 7.1 Review `server/src/modules/users/index.ts` and confirm no new injected dependencies are required (`UserService` already has `workspaceRoleRepository`, `authorizationGuard`, and the `userRepository`); if any wiring IS missing after §4, update `index.ts` and verify `npm run build`.

## 8. API documentation

- [x] 8.1 Add `PATCH /users/{id}/role` to `server/docs/openapi.json` with the request body schema (`workspaceRoleId: uuid`), the response schema (reuse the existing safe-fields user schema), and documented error responses (`400`, `401`, `403`, `404`, `422`). Verify by starting the dev server (`npm run dev`) and opening `/docs` to confirm the endpoint renders.

## 9. Final verification

- [x] 9.1 Run `npm run prettier` and `npm run lint` and verify both complete cleanly.
- [x] 9.2 Run `npm run test` (unit + integration) and verify the full suite passes.
- [x] 9.3 Run `openspec validate add-user-role-update --strict` and verify the change is valid.
