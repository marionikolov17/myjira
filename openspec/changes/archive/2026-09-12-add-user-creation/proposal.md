## Why

The workspace currently has no authenticated way to add users after the one-time
bootstrap; the users module only exposes `GET /users/me`, so privileged operators
cannot grow their team. We need an authorized `createUser` use case so Workspace
Owners and Admins can onboard new members with a controlled, non-privilege-escalating role.

New users must be able to obtain their own credentials without an admin ever handling
a reusable password, so creation provisions the account in a pending state and issues a
single-use, expiring **activation token** that the invitee later exchanges to set their
own password.

## What Changes

- Add a `UserService.createUser()` use case that creates a new workspace user from `name`, `email`, and `workspace_role_id`, with the acting user derived from `actor.user_id`.
- Expose `POST /api/v1/users` (authenticated) in the users controller, validating the request body and returning the created user under a `{ data }` envelope with `201 Created`.
- Enforce authorization via the existing `AuthorizationGuard` on the `workspace` scope / `createUser` action (already configured for Owner and Admin in the authorization matrix).
- Enforce business rules: all fields mandatory; `workspace_role_id` must reference an existing workspace role; the role **cannot be the Workspace Owner role**; email must be unique.
- Provision the new user **without a usable password** (the account cannot authenticate until activated); the client never supplies a password.
- Generate a single-use activation token, store only its **hash** with an expiry, and return the activation token/link **once** in the creation response for the operator to forward (email delivery is a later enhancement).
- **BREAKING (schema)**: make `User.password` nullable, add an account `status` field, and add activation-token fields; requires a Prisma migration.
- Wire the new service through the module `index.ts` (dependency injection) alongside the existing `UserRepository` and `WorkspaceRoleRepository`.

## Out of Scope

- The activation / set-password endpoint the invitee uses to redeem the token (tracked as a separate follow-up change). Until it exists, created users cannot log in.
- Email/notification delivery of the activation link.
- Token resend and revocation flows.

## Capabilities

### New Capabilities

- `user-management`: Authorized creation of a workspace user, covering authorization (Owner/Admin only), mandatory-field and role validation, the rule that a new user cannot be assigned the Workspace Owner role, email uniqueness, provisioning without a usable password, and issuance of a single-use, expiring activation token returned once at creation.

### Modified Capabilities

<!-- None. Authorization behavior is unchanged; the `createUser` action already exists
     in the authorization matrix and the authorization capability's requirements are
     not altered by this change. -->

## Impact

- **Code (server)**:
  - `src/modules/users/user.service.ts` (new) + `user.interface.ts`, `user.schema.ts` (request/params schemas), `user.types.ts` (new params/DTOs).
  - `src/modules/users/user.controller.ts` — add `POST /` route with validation and `{ data }` response.
  - `src/modules/users/user.repository.ts` — persist the new user with a null password, `pending` status, and the activation-token hash + expiry.
  - `src/modules/users/index.ts` — DI wiring for `UserService`.
  - New activation-token helper (deterministic SHA-256 hashing + CSPRNG generation) behind an interface, for testability.
  - Reuses: `WorkspaceRoleRepository` (`getWorkspaceRoleById`), `AuthorizationGuard`, typed errors in `@/common/errors`, `map-prisma-error` for email-uniqueness conflicts.
  - `AuthService.login` — reject users that are not active / have no password (defense in depth once `password` is nullable).
- **Database**: Prisma migration — make `users.password` nullable, add a `status` enum column, and add activation-token columns (hashed token + expiry). Update `prisma/schema.prisma`.
- **Config**: new env vars for activation-token TTL and the activation link base URL.
- **API**: New `POST /api/v1/users` endpoint (matches `docs/04-api/api-design.md` §4.2: 201/400/401/403/409/422/500); response additionally returns the one-time activation token/link.
- **Tests**: New unit tests for `UserService` and controller; integration tests for `POST /users`.
- **Dependencies**: None new.
