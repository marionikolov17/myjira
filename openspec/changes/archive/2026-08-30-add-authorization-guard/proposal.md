## Why

Every functional service in the system design (`WorkspaceService`, `ProjectService`, `IssueService`, `SubtaskService`) is specified to enforce access control through an `AuthorizationGuard` invoked at the start of each method, backed by a declarative `AuthorizationMatrix`. Neither exists in the codebase yet — they appear only in `docs/03-architecture/application-service-design.md`. This is the last cross-cutting concern blocking functional work: the authentication middleware already builds a rich `ActorContext` (workspace role + project roles), but nothing consumes it to make authorization decisions. Building this now gives every upcoming feature a single, consistent, testable enforcement point instead of ad-hoc role checks that would later need to be ripped out.

## What Changes

- Introduce an `AuthorizationGuard` abstraction (interface + implementation) exposing a single `authorize({ actor, scope, action, resource? })` entry point that throws `AuthorizationError` on denial.
- Introduce an `AuthorizationMatrix`: a centralized, declarative configuration mapping `scope + action` to the set of allowed role names.
- Support two scopes:
  - `workspace` — decided against `actor.workspaceRole` (no resource needed).
  - `project` — decided against the actor's role for a given `projectId`, looked up in `actor.projectRoles`.
- The guard is a **pure, DB-free decision function**: it reasons only over the `ActorContext`. It takes no repository dependencies and performs no I/O (Option B).
- Resource resolution stays in the services: any method acting on a child resource (`issue_id`, `subtask_id`) resolves down to a `project_id` using its own repositories, then calls the guard at `project` scope. This reconciles the design's `SubtaskService` "scope: issue" wording into "resolve to `project_id`, authorize at project scope."
- The guard/matrix decisions are intentionally coarse (role gating). Finer-grained business rules (e.g. "an Admin cannot modify a Workspace Owner's role") remain the responsibility of the individual services, not the guard.
- No middleware changes: middleware continues to only authenticate and attach `req.actor`; authorization is invoked explicitly inside services.

## Capabilities

### New Capabilities

- `authorization`: Centralized authorization enforcement for application-layer services — the `AuthorizationGuard` contract, the `AuthorizationMatrix` declarative rule source, the supported scopes (`workspace`, `project`), the actor-only (DB-free) decision model, and the service-owned resource-resolution boundary.

### Modified Capabilities

<!-- None. No existing specs. -->

## Impact

- **New code**: `server/src/common/authorization/` (guard interface, guard implementation, authorization matrix, scope/action types, DI wiring via `index.ts`), following the existing facade + interface-injection conventions in `AGENTS.md`.
- **Errors**: consumes the existing `AuthorizationError` (`@/common/errors`) — no new error types expected.
- **Consumes**: the existing `ActorContext` (`@/common/interfaces`) as its sole decision input.
- **Downstream**: future functional services (`WorkspaceService.createUser`/`updateUserRole`, `ProjectService.*`, `IssueService.*`, `SubtaskService.*`) will depend on the guard and own their `child-id → project_id` resolution. Those services are out of scope for this change.
- **Docs**: `docs/03-architecture/application-service-design.md` was already reconciled for the `updateUserRole` business rule and the `createSubtask` `issue_id` input; the `SubtaskService` scope wording will be reconciled to reflect Option B.
- **Tests**: unit tests for the guard (pure function over mocked `ActorContext`) per the project's unit-test conventions; no integration surface of its own until a functional service consumes it.
