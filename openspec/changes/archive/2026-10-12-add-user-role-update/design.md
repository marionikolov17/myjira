## Context

See `proposal.md` for motivation. Relevant existing constraints:

- The `authorization` capability is intentionally **actor-only**: decisions are a pure function of `scope + action + actor.role` with no I/O (`openspec/specs/authorization/spec.md`). Target-attribute-aware rules do not fit its declarative mapping.
- The `user-management` capability already forbids assigning the Workspace Owner role at user creation and returns a strict safe-fields user resource (no credential/activation material). This design keeps both guarantees.
- The workspace role catalog in play is fixed: `Workspace Owner`, `Workspace Admin`, `Developer`. There is no custom-role story to accommodate yet.
- Only one Owner exists today (Owner cannot be assigned via user-management), but nothing in the design should hard-code that assumption.

## Goals / Non-Goals

**Goals**

- Keep the `authorization` capability pure (declarative, actor-only).
- Make the set of legal role transitions easy to read as a small table, and easy to extend if the role catalog grows.
- Keep the API surface and error shapes consistent with existing user-management endpoints (create, list).
- Make the endpoint safely retryable.

**Non-Goals (design-level, additive to the proposal's non-goals)**

- No new authorization primitive (no "target-aware" policy engine). The target-side rule lives in the capability that owns the role lifecycle.
- No bulk role-update endpoint.
- No change to how actor context is produced; this endpoint consumes the same authenticated-actor context as other user-management endpoints.

## Decisions

### D1. Split the gate into two layers

**Decision.** The endpoint is gated in two stages:

1. **Actor gate** — the `authorization` capability decides whether the actor may call the action at all. New entry in the declarative mapping: `workspace.updateUserRole -> [Workspace Owner]`.
2. **Transition gate** — the `user-management` capability decides whether the specific `(target.currentRole, newRole)` transition is legal.

Both stages raise the **same forbidden error shape** so clients cannot tell which stage denied the request.

**Alternatives considered.**

- *Extend `authorization` with target-attribute-aware policies.* Rejected: it breaks the actor-only invariant that makes the authorization capability simple and I/O-free, and it would be invented solely for this one rule.
- *Put the actor rule in `user-management` too (bypass authorization).* Rejected: it would duplicate the role-matrix pattern already established for `listUsers` and `createUser`, and lose the single source of truth for "who may call this action."

### D2. Express the transition rule as target-role predicates, not an explicit `(from, to, actor)` whitelist

**Decision.** The `user-management` requirement states:

- The target user's current workspace role MUST NOT be Workspace Owner.
- The requested `workspace_role_id` MUST NOT reference the Workspace Owner role.
- The requested `workspace_role_id` MUST reference an existing workspace role.

Combined with the actor gate (Owner-only), these predicates fully describe the transition matrix:

```
                     TARGET'S NEW ROLE
                     Developer     Admin         Owner
TARGET'S  Developer      -        allowed       REJECTED (new=Owner)
CURRENT   Admin        allowed       -          REJECTED (new=Owner)
ROLE      Owner      REJECTED    REJECTED       REJECTED (current=Owner)
```

**Why this phrasing.**

- "Owner self-demotion" is an *emergent* property, not a special case: the actor is the Owner, the actor is the target, the target's current role is Owner, so the first predicate rejects it. No separate "cannot update your own role" rule needed.
- Any future transfer of ownership (into or out of Owner) is also automatically blocked by this endpoint, pointing clients toward a dedicated ownership-transfer flow when that change ships.
- If/when the role catalog grows (e.g. a `Viewer` role), only new scenarios need to be added — the structural rule still holds without edits.

**Alternative considered.** An explicit `(actor_role, from, to)` whitelist table. Rejected: more verbose, harder to extend, and leaks internal matrix shape into the spec text without buying additional clarity.

### D3. Same-role request is an idempotent 200, not a validation error

**Decision.** When the requested role equals the target's current role, the endpoint responds with success and returns the (unchanged) user resource.

**Rationale.** Matches conventional PATCH semantics; makes safe-retry possible (network blip after a successful write still produces a correct outcome on retry); the UX scenario "operator clicked promote on a stale list" still produces the right final state.

**Alternative considered.** 409 Conflict / 400 Validation. Rejected: it adds a failure mode that doesn't correspond to a real problem — the system is already in the state the client asked for.

### D4. Dedicated endpoint path: `PATCH /users/{id}/role`

**Decision.** A dedicated sub-resource endpoint, body `{ "workspace_role_id": "..." }`.

**Rationale.**

- One job, one endpoint — matches the tight scoping of this change.
- Leaves `PATCH /users/{id}` free for a future general profile-update capability without having to carve role out of it later.
- Makes authorization binding trivial: the whole route maps to the single `updateUserRole` action.

**Alternative considered.** Partial `PATCH /users/{id}` with `workspace_role_id` in the body. Rejected for now — would couple role updates to a general update endpoint whose authorization model (field-level allowed roles) does not exist yet.

### D5. Error taxonomy

The endpoint maps conditions to error classes consistently with existing user-management endpoints:

```
+------------------------------------------------+----------------------+
| Condition                                      | Error class / status |
+------------------------------------------------+----------------------+
| No/invalid auth token                          | auth-required / 401  |
| Actor's workspace role != Owner                | forbidden    / 403   |
| Target user does not exist (any workspace)     | not-found    / 404   |
| Target's current role is Workspace Owner       | forbidden    / 403   |
| Body missing workspace_role_id                 | validation   / 400   |
| workspace_role_id references unknown role      | business-rule / 422  |
| workspace_role_id references Workspace Owner   | business-rule / 422  |
| Requested role == target's current role        | success / 200 no-op  |
+------------------------------------------------+----------------------+
```

Denial messages do not reveal which transitions would have been allowed, mirroring the `authorization` capability's existing behavior.

**Why `forbidden` (not 404) when the target is an Owner.** The caller is themselves the Owner, so there is no information leak to hide; a clear `forbidden` lets client UIs render a precise message ("you cannot change the Owner's role through this endpoint") instead of a misleading "not found."

### D6. Concurrency

**Decision.** The role update is a single-row update executed within one transaction; no explicit optimistic-locking token is introduced in this change.

**Rationale.** Both legal transitions (`Dev <-> Admin`) are commutative at the system level — any serial ordering of concurrent Owner requests ends in a state consistent with the final request. There is no "lost update" that produces an invalid state. If/when audit trail arrives, each request will still be recorded individually.

**Trade-off.** Two very-near-simultaneous conflicting requests from different Owner sessions produce a last-write-wins outcome without warning. Acceptable given today's single-Owner reality and the deferred audit capability.

## Risks / Trade-offs

- **Admin inflation with no peer cleanup path.** [Risk] Admins accumulate if Owner is inattentive. → **Mitigation**: this is an accepted trade-off of Option B (Owner-only). The deferred audit-trail capability will give Owners visibility over Admin churn.
- **Owner-absence recovery.** [Risk] If the Owner is inactive, no one can demote a problem Admin via this endpoint. → **Mitigation**: documented as an intentional constraint of this change; an ownership-transfer flow (future change) is the recovery path.
- **Error-stage ambiguity for clients.** [Risk] Clients cannot distinguish actor-gate denial from transition-gate denial. → **Mitigation**: intentional (mirrors `authorization` denial behavior); both are "forbidden" and clients should treat them uniformly.
- **No optimistic concurrency token.** [Risk] Concurrent Owner updates can produce last-write-wins without warning. → **Mitigation**: accepted; the role catalog is tiny and transitions are commutative. Can be reconsidered when audit trail lands.

## Migration Plan

Additive change, no data migration required.

- **Deploy order**: ship the `authorization` config entry for `updateUserRole` in the same release as the endpoint. The endpoint is unusable until both land, which is fine because the endpoint path did not exist before.
- **Rollback**: remove the route and the `updateUserRole` entry from the authorization mapping. No persistent state is introduced by this change, so rollback is a pure code revert.
