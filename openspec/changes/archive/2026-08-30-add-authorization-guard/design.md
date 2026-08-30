## Context

See `proposal.md` — Why. The authentication middleware already resolves a `TokenPayload` into an `ActorContext` (`@/common/interfaces`) and attaches it to `req.actor`:

```ts
interface ActorContext {
  userId: string;
  workspaceRole: { id: string; name: WorkspaceRoleName };
  projectRoles: { projectId: string; projectRoleId: string; projectRoleName: ProjectRoleName }[];
}
```

Constraints that shape this design:

- The codebase uses interface-first DI with singletons wired in each module's `index.ts`, infrastructure hidden behind facades, and typed errors from `@/common/errors` (see `server/AGENTS.md`).
- `WorkspaceRoleName` (`Owner | Admin | Developer`) and `ProjectRoleName` (`ProjectOwner | ProjectAdmin | Developer`) already exist as enums.
- `AuthorizationError` already exists (`Forbidden`, `FORBIDDEN`, 403) and takes no arguments — it deliberately leaks nothing.
- The spec (`specs/authorization/spec.md`) requires an actor-only, I/O-free decision, a declarative role source, deny-by-default for unknown actions, and the two scopes `workspace` and `project`.

## Goals / Non-Goals

**Goals:**

- A pure, synchronous, dependency-free `AuthorizationGuard` that decides from `ActorContext` alone.
- A single declarative `AuthorizationMatrix` mapping `scope + action → allowed role names`.
- Strongly-typed scopes and actions so the matrix and call sites are checked at compile time.
- A shape that services call in one line at the top of each method.

**Non-Goals:**

- Wiring the guard into any functional service (WorkspaceService, ProjectService, etc.) — those are separate future changes.
- Resource resolution (`issue_id`/`subtask_id → project_id`) — this stays in the calling services (Option B); the guard never performs lookups.
- Any middleware changes — middleware keeps only authenticating and attaching `req.actor`.
- Field-level or business-rule checks (e.g. "Admin cannot modify an Owner") — those remain in services.

## Decisions

### D1: Guard is a pure synchronous function over `ActorContext`

`authorize(...)` takes the already-built `ActorContext` and returns `void`, throwing `AuthorizationError` on denial. It is synchronous (no `Promise`) and takes no repository/DB dependencies.

- **Why:** The spec mandates actor-only, I/O-free decisions. Synchronous keeps call sites clean and makes the guard trivially unit-testable with a plain mocked context.
- **Alternative considered:** An async guard that resolves resources itself (Option A) — rejected earlier for coupling the guard to many repositories and the DB.

### D2: Single entry point with a discriminated-union input

The guard exposes one method whose input is a discriminated union on `scope`, so the `project` scope requires a `resource` (project id) and the `workspace` scope forbids it — enforced by the type system.

```ts
export enum AuthorizationScope {
  Workspace = 'workspace',
  Project = 'project',
}

export type AuthorizationAction =
  | 'createUser' | 'updateUserRole'                          // workspace
  | 'createProject'                                          // workspace
  | 'addProjectMember' | 'updateProjectRole' | 'updateProject'
  | 'createIssue' | 'assignIssue' | 'updateIssueStatus'
  | 'createSubtask' | 'assignSubtask' | 'updateSubtaskStatus'; // project

export type AuthorizeInput =
  | { actor: ActorContext; scope: AuthorizationScope.Workspace; action: AuthorizationAction }
  | { actor: ActorContext; scope: AuthorizationScope.Project;  action: AuthorizationAction; resource: string };

export interface IAuthorizationGuard {
  authorize(input: AuthorizeInput): void;
}
```

- **Why:** The union makes "missing project id for project scope" a compile-time error at call sites, while the runtime guard still defends against it (spec: "missing project identifier is rejected"). A single method matches the design doc's `AuthorizationGuard.authorize({...})`.
- **Alternative considered:** Separate `authorizeWorkspace` / `authorizeProject` methods — clearer types but diverges from the documented single-entry API and spreads the matrix lookup across methods.

### D3: The matrix is a nested constant keyed by scope then action

```ts
type AllowedRoles = {
  [AuthorizationScope.Workspace]: Partial<Record<AuthorizationAction, WorkspaceRoleName[]>>;
  [AuthorizationScope.Project]:   Partial<Record<AuthorizationAction, ProjectRoleName[]>>;
};

export const authorizationMatrix: AllowedRoles = {
  [AuthorizationScope.Workspace]: {
    createUser:     [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
    updateUserRole: [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
    createProject:  [WorkspaceRoleName.OWNER, WorkspaceRoleName.ADMIN],
  },
  [AuthorizationScope.Project]: {
    addProjectMember:   [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN],
    updateProjectRole:  [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN],
    updateProject:      [ProjectRoleName.PROJECT_OWNER],
    createIssue:        [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN, ProjectRoleName.DEVELOPER],
    assignIssue:        [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN, ProjectRoleName.DEVELOPER],
    updateIssueStatus:  [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN, ProjectRoleName.DEVELOPER],
    createSubtask:      [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN, ProjectRoleName.DEVELOPER],
    assignSubtask:      [ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN, ProjectRoleName.DEVELOPER],
    updateSubtaskStatus:[ProjectRoleName.PROJECT_OWNER, ProjectRoleName.PROJECT_ADMIN, ProjectRoleName.DEVELOPER],
  },
};
```

The "project member" rules from the design (issue/subtask actions) map to "any project role," so they list all three project roles. `updateProject` is Project Owner only, per the design.

- **Why:** Keying by scope keeps workspace entries typed to `WorkspaceRoleName` and project entries to `ProjectRoleName`, preventing cross-scope role mistakes. `Partial<Record<...>>` plus deny-by-default (D4) means an omitted action is simply denied.
- **Alternative considered:** A flat `action → roles` map — loses per-scope role typing and can't distinguish a workspace `Owner` from a project `ProjectOwner`.

### D4: Deny by default; denial throws `AuthorizationError`

Lookup order: resolve the scope bucket, then the action entry. If the action has no entry, deny. For `project` scope, if `resource` is missing/empty or the actor has no `projectRoles` entry for that `projectId`, deny. Otherwise permit iff the actor's role for that scope is in the allowed list. Every denial throws the existing `AuthorizationError` (403, no detail); a permit returns `void`.

- **Why:** Matches the spec's deny-by-default, non-disclosing error, and side-effect-free success requirements; reuses the existing error taxonomy.

### D5: Location and DI wiring

New folder `server/src/common/authorization/` (a common cross-cutting concern, like `token-service`/`password-hasher`):

```
common/authorization/
  authorization.types.ts          # AuthorizationScope, AuthorizationAction, AuthorizeInput
  authorization-matrix.ts         # authorizationMatrix constant
  authorization-guard.interface.ts# IAuthorizationGuard
  authorization-guard.ts          # AuthorizationGuard implements IAuthorizationGuard
  index.ts                        # exports singleton `authorizationGuard` + types/interface
```

The guard is stateless, so `index.ts` exports a singleton `authorizationGuard = new AuthorizationGuard(authorizationMatrix)`. Injecting the matrix (rather than importing it inside the class) keeps the guard unit-testable with a custom matrix.

- **Why:** Follows the existing `common/` facade + `index.ts` singleton convention; consumers depend on `IAuthorizationGuard`.

## Risks / Trade-offs

- **Matrix and services drift out of sync** → The `AuthorizationAction` union is the shared contract; adding a service method without a matrix entry yields deny-by-default (safe fail-closed) and, where the action string is new, a compile error. Unit tests assert each action's allowed roles.
- **Guard trusts `ActorContext` correctness** → The context is built once by the authenticated middleware from persisted roles; the guard is only as current as the token/context. Accepted: re-resolving per request is out of scope and unchanged from today's model.
- **Deny-by-default can mask a forgotten entry as a 403** → Mitigated by unit tests covering every action in the matrix and by the typed action union making omissions visible during review.
- **Coarse role gating only** → Finer rules (Owner-protection, self-modification) intentionally live in services; the spec and proposal state this explicitly, so it is a deliberate boundary, not a gap.
