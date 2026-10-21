## Context

See `proposal.md` for motivation. Relevant existing state:

- Prisma models `Project`, `ProjectMember`, and `ProjectRole` already exist, but no `projects` module exposes them. `ProjectMember` has a unique constraint on `(projectId, userId)`.
- `common/authorization/` already implements declarative RBAC via a `scope + action -> allowed roles` matrix (`AuthorizationGuard.authorizeProject` requires an actor project-role on the target project).
- `project-members/` module exists but only exposes `getProjectMembersByUserId` — used by actor context to populate `actor.projectRoles`. No creation path exists.
- The `users` module is the canonical template for controller/service/repository/schema/interface/types/query-config/DI layout and for list-endpoint pagination (`Paginated<T>`, `buildPaginationMeta`, stable `orderBy`).
- Foreign keys from `project_members`, `issues`, and `subtasks` currently default to `NO ACTION` on delete.

## Goals / Non-Goals

**Goals:**

- Deliver all five header-level project endpoints behind one coherent `projects` capability.
- Model the "a workspace role can satisfy a project-scope action regardless of membership" rule declaratively, as the smallest possible extension of the existing authorization capability.
- Give services a transaction primitive they can use without ever touching Prisma directly.
- Guarantee that every created project has exactly one Project Owner member, atomically.

**Non-Goals:**

- Any project-members, issues, or subtasks endpoint.
- Any search over `name` or `description`.
- Any soft-delete, archival, or restore semantics.
- A general predicate-based ABAC engine. `workspaceBypass` is deliberately a narrow, data-driven extension and remains an RBAC matrix at heart.
- Any public endpoint under `/project-members` (the repository gains one internal method; no HTTP surface).

## Decisions

### D1. Authorization — extend the matrix with `workspaceBypass` (hybrid RBAC, ABAC-shaped)

A project-scope matrix entry becomes either an array of project roles (the existing shape) or an object `{ projectRoles, workspaceBypass }` where `workspaceBypass` lists workspace roles that satisfy the action regardless of project membership. The guard first checks `workspaceBypass` against `actor.workspaceRole.name`; if that does not apply, it falls through to the existing project-role check. All existing matrix entries keep the array shape — no migration of unrelated actions.

New / updated entries:

| Scope     | Action           | projectRoles                                           | workspaceBypass          |
|-----------|------------------|--------------------------------------------------------|--------------------------|
| workspace | `listProjects`   | n/a (workspace scope — role list)                      | n/a                      |
| workspace | `createProject`  | existing: `OWNER, ADMIN`                               | n/a                      |
| project   | `getProjectById` | `PROJECT_OWNER, PROJECT_ADMIN, DEVELOPER`              | `OWNER, ADMIN`           |
| project   | `updateProject`  | `PROJECT_OWNER`                                        | `OWNER`                  |
| project   | `deleteProject`  | `PROJECT_OWNER`                                        | `OWNER`                  |

Admin asymmetry (Admin bypasses reads but not writes) is deliberate for this iteration and is removable by matrix edit alone.

**Alternatives considered:**

- *Ad-hoc overrides in each service method* — rejected: scatters authorization logic and breaks the "single declarative source of truth" promised by `authorization/spec.md`.
- *Full predicate-based ABAC (`(actor, resource, action) -> decision`)* — rejected for now: more mechanism than our requirements justify, and defeats the "read the matrix to understand permissions" property. Keeps the door open to adopt later without rewriting the matrix.

### D2. `listProjects` scoping is a service-layer responsibility, not an authorization decision

Authorization answers yes/no for calling the endpoint (all three workspace roles are allowed). The service then applies a scoping policy before calling the repository:

```
scoping = (actor.workspaceRole in {OWNER, ADMIN})
            ? no additional where
            : { membership: { some: { userId: actor.id } } }
```

The repository exposes an optional `actorMembershipFilter: { userId: string } | undefined` on its list method so the service — not the repository — owns the policy. This keeps the authorization capability pure (no I/O, no filtering) and keeps the repository mechanical.

**Alternative:** encode scoping inside the matrix as a per-row predicate. Rejected: would push us toward D1's `γ` option prematurely.

### D3. Transaction orchestration — introduce `IUnitOfWork` in `common/`

A new primitive under `server/src/common/unit-of-work/`:

```ts
interface TransactionalRepos {
  projects: IProjectRepository;
  projectMembers: IProjectMemberRepository;
}

interface IUnitOfWork {
  run<T>(work: (repos: TransactionalRepos) => Promise<T>): Promise<T>;
}
```

The Prisma-backed implementation wraps `prisma.$transaction(async (txClient) => ...)` and constructs transaction-bound repository instances (same classes, different Prisma handle) to hand to the callback. Services see only interfaces; the Prisma client never crosses the service boundary.

`ProjectService.createProject` uses it:

```
await unitOfWork.run(async (tx) => {
  const project = await tx.projects.createProject({name, description, creatorId: actor.id});
  await tx.projectMembers.createProjectMember({
    projectId: project.id,
    userId: actor.id,
    projectRoleId: await projectMemberRepository.getProjectRoleIdByName(PROJECT_OWNER),
  });
  return project;
});
```

(The `getProjectRoleIdByName` lookup is read-only and runs on the base client — it does not need to be inside the transaction.)

**Alternatives considered:**

- *Nested Prisma write inside `ProjectRepository.createProject`* (`project.create({ data: { ..., members: { create: {...} }}})`) — faster to ship but makes `ProjectRepository` write into `project_members`, blurring the one-repository-per-table boundary and offering nothing for the next multi-write use case (issues referencing projects, subtasks referencing issues).
- *Service receives a Prisma transaction handle directly* — rejected: leaks persistence into service.
- *Domain events / outbox* — rejected: massively over-scope for a two-row insert.

To keep the `TransactionalRepos` interface from growing a new field for every future module, future repositories will be added as needed; this change ships with only `projects` and `projectMembers` because those are all we transact over today.

### D4. Hard delete with database-level cascade

The Prisma migration introduces `onDelete: Cascade` on three foreign keys:

- `project_members.project_id -> projects.id`
- `issues.project_id -> projects.id`
- `subtasks.issue_id -> issues.id`

A single `DELETE FROM projects WHERE id = ...` then removes a project, its members, its issues, and those issues' subtasks in one database operation. The service wraps the delete in `unitOfWork.run` for consistency even though a single statement is already atomic — this keeps the "all writes go through unit-of-work" discipline.

**Alternatives considered:**

- *Service-orchestrated cascade (`deleteMany subtasks` → `deleteMany issues` → `deleteMany members` → `delete project`)* — rejected: duplicates database-level referential integrity in application code, more round-trips, more surface for bugs.
- *Block delete when issues exist* — rejected per Q3; the user wants the fastest path and will refactor to soft-delete later.

### D5. PATCH shape — `name?` and `description?`, at least one required

Zod schema is a strict object with both fields optional, plus a refine that rejects empty payloads with a validation error naming no specific field. The service passes through only the fields present in the payload, so unspecified fields are not overwritten.

### D6. Query configuration (header level only)

Mirrors the users config shape, trimmed to project semantics:

| Field       | Sortable | Filter operators                        |
|-------------|----------|-----------------------------------------|
| `name`      | yes      | (none — intentionally excluded)         |
| `creatorId` | no       | `eq`, `ne`, `in`                        |
| `createdAt` | yes      | `eq`, `gt`, `gte`, `lt`, `lte`          |
| `updatedAt` | yes      | `eq`, `gt`, `gte`, `lt`, `lte`          |

Rationale for `name` sortable but not filterable: equality/inequality filters on a free-text field are low-value without a `like`/`contains` operator, and we are not introducing search operators in this change.

### D7. Resource name and response shapes

- Repository `resourceName = 'projects'` for the unified error model.
- Create response: `{ data: Project }` with status 201.
- Get-by-id and PATCH responses: `{ data: Project }` with status 200.
- List response: `{ data: Project[], meta: { pagination: { page, pageSize, totalItems, totalPages } } }` with status 200.
- Delete response: status 204, empty body.
- Project resource shape: `id`, `name`, `description`, `creatorId`, `createdAt`, `updatedAt`. No `members`, no `issues`, no `creator` expansion at this layer.

## Risks / Trade-offs

- **[Risk] The `TransactionalRepos` interface will churn as we add issues/subtasks/etc.** → Mitigation: the churn is additive and type-checked at every service callsite; adding a field forces every consumer to opt-in. Acceptable.
- **[Risk] Cascade delete removes real data irreversibly.** → Mitigation: documented as temporary; the follow-up soft-delete change can keep cascade semantics via `deletedAt` propagation without a destructive migration. Audit logging is out of scope for this change.
- **[Risk] The Admin-can-read-but-not-write asymmetry may surprise consumers.** → Mitigation: documented in the capability spec; a one-line matrix edit flips it later.
- **[Risk] Repository scoping policy for `listProjects` crosses the layer boundary slightly** (the repository must accept a membership filter it would not otherwise need). → Mitigation: the parameter is a typed, optional object the service builds; the repository stays mechanical and knows nothing about workspace roles.
- **[Trade-off] `IUnitOfWork` costs some boilerplate for the single current use case** (create project + bootstrap member). The next multi-write feature (issues or members CRUD) immediately amortizes it.

## Migration Plan

1. Author Prisma migration `add_project_cascade_deletes` adding `onDelete: Cascade` to the three listed FKs; run against local dev DB and the test DB.
2. Deploy order in a single release:
   - Database migration applied first.
   - Server rollout with the new module and matrix extension.
3. **Rollback**: a prior server image continues to work against the migrated schema (cascade is a stricter FK option, not a breaking change). Rolling the migration back is possible via a reverse migration if required but not planned.

There is no data backfill; existing projects (there are none in production yet) are unaffected.
