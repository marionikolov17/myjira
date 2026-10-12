## Why

The user-management capability currently lets Owners and Admins create workspace users, but once a user is created there is no supported way to change their workspace role. Operators have no path to promote a productive Developer to Admin, nor to correct a mistaken role assignment, without re-creating the user. This change introduces a narrowly scoped, Owner-only endpoint to update a workspace user's role between Developer and Admin, keeping the Owner as the sole authority over the Admin circle.

## What Changes

- Add a dedicated endpoint `PATCH /users/{id}/role` that accepts `{ "workspace_role_id": "..." }`.
- Restrict access to the Workspace Owner role only (declared via the authorization capability's allowed-role mapping).
- Permit only the transitions `Developer -> Admin` and `Admin -> Developer`; reject any transition that involves the Workspace Owner role (either as the target's current role or as the requested new role).
- Treat a request whose requested role equals the target's current role as an idempotent no-op (success with the unchanged user).
- Reuse the existing safe-fields user resource shape in the response (no credential, password, or activation material).
- Allow role updates on users whose account has not yet been activated.
- Add a new `updateUserRole` entry to the authorization capability's declarative mapping (`workspace` scope, allowed roles: `[Workspace Owner]`). This is a configuration/data change; the authorization capability's own spec does not change.

Non-goals (explicitly out of scope for this change):

- Ownership transfer (any transition into or out of the Workspace Owner role).
- Changing other user fields (name, email, status) through this endpoint.
- An audit trail for role changes — planned as a separate, reusable capability in a follow-up change.

## Capabilities

### New Capabilities

<!-- None. This change modifies existing capabilities only. -->

### Modified Capabilities

- `user-management`: add new requirements for Owner-only role update between Developer and Admin, with explicit rejection of any Owner-involving transition, idempotent no-op on same-role requests, and the existing safe-fields response envelope. The requirement names the `updateUserRole` action and its allowed roles inline (`[Workspace Owner]`), following the same pattern already used by the `listUsers` requirement.

The `authorization` capability's spec is intentionally not modified: it defines the authorization mechanism (declarative mapping, actor-only decisions, deny-by-default), while per-action allowed-role entries are configuration data referenced by the capabilities that own each action. Adding `workspace.updateUserRole -> [Workspace Owner]` to that mapping is a configuration/data change that does not alter any spec-level behavior of the authorization capability itself.

## Impact

- **API surface**: new `PATCH /users/{id}/role` endpoint. No change to existing user-management endpoints.
- **Authorization configuration**: one new entry in the declarative allowed-roles mapping (`workspace.updateUserRole -> [Workspace Owner]`). No change to the authorization decision engine itself.
- **Persistence**: existing `workspace_role_id` column on the user record is reused; no schema change.
- **Clients**: additive change; no breaking impact on existing clients.
- **Dependencies**: none added.
