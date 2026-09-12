## Context

See `proposal.md` — Why. This design covers the server-side `createUser` use case plus
the activation-token issuance that lets an invitee later set their own password without an
operator ever handling a reusable credential.

Relevant current state and constraints:

- **Layering / DI**: controller → service → repository, collaborators injected via
  constructor and wired in `index.ts` (see `src/modules/auth/index.ts`). Business logic
  lives in the service; persistence in the repository; validation in the controller.
- **Authorization**: `AuthorizationGuard.authorize({ actor, scope, action })` is the
  single enforcement point. The `workspace` / `createUser` action already exists in
  `authorization-matrix.ts` allowing `Owner` and `Admin`. No matrix change needed.
- **Persistence**: Prisma 7 on PostgreSQL. `User.password` is currently `String`
  (non-null); `email` is `@unique`. Repositories map failures via `map-prisma-error`.
- **Hashing**: `IPasswordHasher` (bcrypt) exists for passwords. There is no token-hashing
  utility yet.
- **Config**: env parsed/validated with Zod in `src/config/env.ts` (e.g. `SALT_ROUNDS`,
  `JWT_*`, bootstrap user config).
- **Existing consumers of `User.password`**: `AuthService.login`
  (`getUserByEmailWithPassword`) and `WorkspaceService.bootstrapWorkspaceUsers`
  (creates users from config, each with a password).

## Goals / Non-Goals

**Goals:**

- Implement `UserService.createUser()` and `POST /api/v1/users` per the `user-management` spec.
- Provision new users in a `pending` state with no usable password.
- Issue a single-use, expiring activation token; persist only its hash; return it once.
- Make the data model and auth path safe now that a user may have no password.

**Non-Goals (design-level boundaries beyond proposal Out of Scope):**

- No activation/set-password endpoint, no email delivery, no resend/revocation (follow-up).
- No changes to the authorization matrix or the authorization capability.
- No pagination/listing/retrieval changes (other `UserService` methods are separate work).

## Decisions

### D1. Deterministic SHA-256 for the activation-token hash (not bcrypt)

The token must be **looked up** during activation, so its stored form must be
deterministic. bcrypt is salted/non-deterministic and cannot be queried by value.

- Generate the raw token with a CSPRNG (`crypto.randomBytes(32)`, base64url) → ~256 bits.
- Store `activationTokenHash = sha256(rawToken)` (hex), plus `activationTokenExpiresAt`.
- Storing only the hash is safe because the token is high-entropy (unlike passwords,
  which need bcrypt precisely because they are low-entropy).
- Wrap generation + hashing behind a small interface (e.g. `IActivationTokenService` with
  `generate()` → `{ token, tokenHash, expiresAt }` and `hash(token)`), injected into the
  service, so it can be mocked in unit tests — consistent with the facade pattern.
- **Alternative considered**: selector+verifier (separate indexed selector + hashed
  verifier, constant-time compare). More robust against timing side-channels but heavier;
  for an internal API a single indexed SHA-256 lookup is sufficient. Documented as a
  future hardening option.

### D2. Explicit account `status` enum (`pending` / `active`)

Track activation with an explicit `UserStatus` enum rather than inferring from
`password IS NOT NULL`. It is more readable, future-proof (e.g. `disabled` later), and
makes login gating unambiguous.

- Prisma: `enum UserStatus { Pending Active }` (mapped like existing enums), `User.status`
  defaults to `Pending`.
- **Alternative considered**: infer state from a null password. Minimal, but implicit and
  brittle; rejected for clarity.

### D3. `User.password` becomes nullable

A pending user has no password. Password is set only at activation (follow-up).

- Prisma: `password String?`.
- Migration must **backfill existing rows** (bootstrap users, who have passwords) to
  `status = Active`, then leave the column default `Pending` for new inserts.

### D4. Login gating for non-active users

Now that a password may be absent, `AuthService.login` must fail safely for pending users.

- Treat "no password" / `status != Active` as invalid credentials, returning the existing
  `InvalidLoginCredentialsError` (do not disclose account state).
- This keeps the spec's "unactivated user cannot log in" guaranteed even though the
  activation endpoint isn't built yet.

### D5. Response returns a one-time activation link (token embedded)

Return the full activation link (base URL + token) once, alongside the created user in the
`{ data }` envelope. Returning a link (not just the raw token) is what the operator
actually forwards and keeps the URL shape owned by the server.

- New config: `ACTIVATION_URL_BASE` (link prefix) and `ACTIVATION_TOKEN_TTL_SECONDS`
  (expiry), validated in `env.ts`.
- Example shape:
  ```json
  {
    "data": {
      "user": { "id": "...", "name": "...", "email": "...", "workspaceRoleId": "...", "status": "pending", "createdAt": "...", "updatedAt": "..." },
      "activation": { "url": "https://app.example.com/activate?token=<raw>", "expiresAt": "..." }
    }
  }
  ```
- The raw token/link is never persisted and never returned again (only its hash is stored).

### D6. Error mapping (aligns with `api-design.md` §4.2)

- Not Owner/Admin → `AuthorizationError` (403) via the guard.
- Missing/invalid fields → Zod validation → `ValidationError` (400) in the controller.
- `workspace_role_id` not found, or resolves to the **Owner** role → `BusinessRuleViolationError` (422).
- Duplicate email → `ConflictError` (409), mapped from Prisma P2002 by `map-prisma-error`.

### D7. Password remains server-owned; none created in this change

Because activation sets the password later, this change generates **no** password and does
not use `PasswordHasher`. The account is created with `password = null`.

## Risks / Trade-offs

- **[Feature is not end-to-end usable]** Created users cannot log in until the follow-up
  activation endpoint ships. → Explicitly scoped/communicated in the proposal; login gating
  (D4) ensures correct, safe behavior in the interim.
- **[Token leakage via logs]** The activation link/token could leak through request or error
  logging. → Ensure the request logger and error middleware redact the response body / the
  `token` query param; never log the raw token.
- **[Migration on existing data]** Making `password` nullable + adding `status` could leave
  bootstrap users unable to log in if mis-backfilled. → Backfill existing rows to
  `status = Active` in the same migration (D3); cover with an integration test.
- **[Deterministic hash correctness]** Using bcrypt by mistake would break future lookups.
  → D1 mandates SHA-256; unit-test that the stored hash equals `sha256(raw)`.
- **[No expiry enforcement yet]** Expiry is only checked at activation (follow-up), so a
  stored token lingers until then. → Persist `expiresAt` now so the follow-up can enforce
  it; acceptable because the token is unusable without the activation endpoint.

## Migration Plan

1. Update `prisma/schema.prisma`: `password String?`, add `enum UserStatus { Pending Active }`,
   add `status UserStatus @default(Pending)`, `activationTokenHash String?`,
   `activationTokenExpiresAt DateTime?`; index `activationTokenHash`.
2. Create the migration; in it, backfill all existing users to `status = Active`.
3. Add env vars (`ACTIVATION_URL_BASE`, `ACTIVATION_TOKEN_TTL_SECONDS`) to `env.ts` and env files.
4. Deploy migration before/with the new endpoint. **Rollback**: revert the endpoint; the
   added columns are additive and nullable and can remain, or be dropped in a down migration
   (note `password` would need repopulation before re-enforcing non-null — not planned).

## Open Questions

- Exact `ACTIVATION_TOKEN_TTL_SECONDS` default (e.g. 24h vs 72h) — safely tunable via config
  without affecting specs or task breakdown.
- Whether the created-user response nests `user`/`activation` (as in D5) or flattens the
  activation link — cosmetic; can be finalized when writing the controller.
