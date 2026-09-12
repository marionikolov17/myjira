## 1. Data model & migration

- [x] 1.1 Update `prisma/schema.prisma`: add `enum UserStatus { Pending Active }` (with `@@map`), change `User.password` to `String?`, add `status UserStatus @default(Pending)`, `activationTokenHash String?`, and `activationTokenExpiresAt DateTime?`; add `@@index([activationTokenHash])`. Verify with `npx prisma validate` / `npm run prettier`.
- [x] 1.2 Create the migration (`npm run db:migrate`) and edit it to backfill all existing rows to `status = 'Active'`. Verify the migration applies cleanly on a fresh DB and existing (bootstrap) users end up `Active`.
- [x] 1.3 Regenerate the Prisma client (`npx prisma generate`) and verify the build typechecks (`npm run build`).

## 2. Configuration

- [x] 2.1 Add `ACTIVATION_URL_BASE` (validated URL) and `ACTIVATION_TOKEN_TTL_SECONDS` (coerced number, sensible default e.g. 86400) to the Zod schema in `src/config/env.ts` and to `.env.local` / `.env.test`. Verify the app boots and `env` parses with the new vars.

## 3. Activation-token helper

- [x] 3.1 Add an `IActivationTokenService` interface exposing `generate(): { token; tokenHash; expiresAt }` and `hash(token): string`, and a concrete implementation using `crypto.randomBytes(32)` (base64url) + deterministic `sha256` (hex), reading TTL from config. Verify unit tests assert `hash(token) === sha256(token)`, tokens are unique across calls, and `expiresAt` respects the configured TTL.

## 4. Repository

- [x] 4.1 Extend `CreateUserParams` and `UserRepository.createUser` (in `user.types.ts` / `user.repository.ts`) to persist `password: null`, `status: Pending`, `activationTokenHash`, and `activationTokenExpiresAt`; keep the existing `select` free of sensitive fields. Verify with a repository/integration test that the row is created with a null password and pending status and that the select never returns password/token hash.

## 5. Schemas & types

- [x] 5.1 Add a `CreateUserRequestSchema` (Zod) in `user.schema.ts` requiring `name`, `email` (valid email), `workspaceRoleId` (uuid), rejecting unknown/credential fields; add the service param and response DTO types in `user.types.ts` (including `status` and the one-time `activation` link/expiry). Verify unit tests cover accept/reject cases (missing field, bad email, extra password field).

## 6. UserService.createUser

- [x] 6.1 Create `user.service.ts` (+ `IUserService` in `user.interface.ts`) with `createUser(actor, input)` that: calls `AuthorizationGuard.authorize({ actor, scope: workspace, action: createUser })`; loads the role via `WorkspaceRoleRepository.getWorkspaceRoleById` and throws `BusinessRuleViolationError` if missing or if it is the `Owner` role; generates the activation token; persists via the repository; and returns the created user plus the one-time activation link. Verify unit tests (mocked collaborators) cover: unauthorized actor → `AuthorizationError`; unknown role → 422; Owner role → 422; success returns user + activation link and stores only the token hash.
- [x] 6.2 Ensure duplicate-email creation surfaces as `ConflictError` (via `map-prisma-error` P2002 in the repository). Verify a unit/integration test asserts a duplicate email throws `ConflictError`.

## 7. Controller & routing

- [x] 7.1 Add `POST /` to `user.controller.ts`: guard non-object body with `isPlainObject`, `CreateUserRequestSchema.parse(body)`, call the service with `req.actor`, respond `201` with `{ data: { user, activation } }`; on error `next(error)`. Register the route behind `requireAuthenticationMiddleware`. Verify the route is mounted under `/api/v1/users` in `app.ts`.

## 8. Dependency injection

- [x] 8.1 Wire `UserService` (with `userRepository`, `workspaceRoleRepository`, `authorizationGuard`, `activationTokenService`, `logger`) and inject it into `UsersController` in `src/modules/users/index.ts`; export the singletons. Verify `npm run build` succeeds and the server starts.

## 9. Login gating

- [x] 9.1 Update `AuthService.login` to reject users whose `status` is not `Active` or whose `password` is null, returning `InvalidLoginCredentialsError` without disclosing account state. Verify a unit test: a pending/no-password user cannot log in; an active user still can.

## 10. Log redaction

- [x] 10.1 Ensure the request-logger and error middleware do not log the activation token/link (redact the response body and any `token` query param). Verify by inspecting logs in an integration test (or asserting the redaction helper) that the raw token never appears.

## 11. Integration verification

- [x] 11.1 Add integration tests for `POST /api/v1/users` covering the spec end to end: Owner/Admin success (201, body shape, activation link present, password/hash absent), non-privileged actor (403), unauthenticated (401), missing/invalid fields (400), unknown role and Owner-role assignment (422), duplicate email (409). Verify with `npm run test:integration`.
- [x] 11.2 Run `npm run lint`, `npm run prettier`, and `npm run test` and verify all pass.
