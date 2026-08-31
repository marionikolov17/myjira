## 1. Types and matrix

- [x] 1.1 Create `server/src/common/authorization/authorization.types.ts` defining `AuthorizationScope` (enum: `Workspace`, `Project`), the `AuthorizationAction` union, and the `AuthorizeInput` discriminated union (project scope requires `resource`, workspace scope forbids it) per design D2; verify it compiles with `npm run build`.
- [x] 1.2 Create `server/src/common/authorization/authorization-matrix.ts` exporting the `authorizationMatrix` constant typed by scope (`WorkspaceRoleName[]` for workspace actions, `ProjectRoleName[]` for project actions) with the exact allowed roles from design D3; verify it type-checks against the scope-keyed `AllowedRoles` type via `npm run build`.

## 2. Guard

- [x] 2.1 Create `server/src/common/authorization/authorization-guard.interface.ts` defining `IAuthorizationGuard` with `authorize(input: AuthorizeInput): void`; verify it compiles.
- [x] 2.2 Create `server/src/common/authorization/authorization-guard.ts` implementing `AuthorizationGuard` (constructor takes the matrix): resolve scope bucket then action entry, deny-by-default for unknown actions, and for project scope require a non-empty `resource` and an `actor.projectRoles` entry matching that `projectId`; permit only when the actor's role for the scope is in the allowed list, otherwise throw `AuthorizationError`; verify the guard unit tests in 4.x pass.

## 3. Wiring

- [x] 3.1 Create `server/src/common/authorization/index.ts` exporting the `authorizationGuard` singleton (`new AuthorizationGuard(authorizationMatrix)`), plus the interface and public types; verify the singleton imports cleanly (`npm run build`).

## 4. Unit tests

- [x] 4.1 Add `server/tests/unit/common/authorization/authorization-guard.mock.ts` with mock `ActorContext` fixtures (owner/admin/developer workspace roles; member/non-member project roles) and a test matrix, following the unit-test conventions; verify fixtures type-check against domain types.
- [x] 4.2 Add `server/tests/unit/common/authorization/authorization-guard.test.ts` covering: workspace allow/deny, project member-with-allowed-role allow, disallowed-role deny, non-member deny, missing/empty `resource` deny, unknown/unconfigured action deny, `AuthorizationError` thrown on every denial, and no throw (void) on permit; verify `npm run test:unit` passes.

## 5. Verification

- [x] 5.1 Run `npm run lint`, `npm run prettier`, and `npm run test:unit` — all pass. NOTE: `npm run build` fails on a pre-existing, unrelated issue (the Prisma 7 generated TypeScript client lives outside `tsconfig.build.json`'s `rootDir: src`); compilation of the new module was verified with `tsc --noEmit -p tsconfig.json` (clean).
- [x] 5.2 Run `openspec validate add-authorization-guard --strict` and confirm the change is valid.
