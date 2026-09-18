## Context

See `proposal.md` — Why, and `specs/user-management/spec.md` for the behavior contract added by this change. This design covers the server-side `GET /api/v1/users` route as the first consumer of the already-built `query-parameters` capability.

Relevant current state and constraints:

- **Layering / DI**: controller → service → repository, collaborators injected via constructor and wired in `src/modules/users/index.ts`. Business logic in the service, persistence in the repository, validation in the controller (see `server/AGENTS.md`).
- **Shared query layer** already exists in `src/common/query/`:
  - `queryParser: IQueryParser` — singleton, `parse(rawQuery, config) → QueryOptions`, raises `ValidationError` on any invalid input.
  - `toPrismaFindArgs(options) → { skip, take, orderBy, where }` — pure translation to Prisma-shaped args.
  - `buildPaginationMeta(page, pageSize, totalItems) → { page, pageSize, totalItems, totalPages }` — pure meta builder.
  - `QueryConfig` allow-list types (sortable fields, filterable fields with per-field operators and a Zod value schema, `defaultPageSize`, `maxPageSize`).
  - Nothing consumes these yet — this change is the first.
- **Authorization**: `AuthorizationGuard.authorize({ actor, scope, action })` is the single enforcement point; matrix in `common/authorization/authorization-matrix.ts`. No `listUsers` entry exists yet.
- **Users repository** already exposes a single private `select` returning the safe fields (`id`, `name`, `email`, `workspaceRoleId`, `status`, `createdAt`, `updatedAt`) reused by every read/create path. Password and activation-token columns are never selected there.
- **Users response schema**: a single `UserSchema` covering all safe fields including `status`. No separate created/listed variants exist — every persistence method parses through the same schema.
- **API design**: `GET /users` returns 200/401/403/500 (`docs/04-api/api-design.md` §4.2). Collection envelope shape and pagination meta are §6.2. Query conventions are §5.

## Goals / Non-Goals

**Goals:**

- Introduce `GET /api/v1/users` as a real consumer of the shared query layer, without re-implementing any parsing, meta building, or Prisma translation.
- Keep concerns split cleanly across the three layers: the controller owns transport + query parsing; the service owns authorization + orchestration; the repository owns persistence.
- Guarantee deterministic pagination so clients paging through the list never see repeats or gaps between pages.
- Guarantee the response body is provably free of credential/activation-token data by construction, not by ad-hoc field filtering.

**Non-Goals (design-level boundaries beyond proposal Out of Scope):**

- No changes to the shared `query-parameters` capability, its parser, mapper, or meta builder.
- No new filter operators, no default sort field that the client can't override, no new response envelope shape.
- No other user endpoints (`GET /users/{id}`, `GET /users/me`, updates) — this design is scoped to listing.

## Decisions

### D1. Users `QueryConfig` lives in a new module file `user.query-config.ts`

The users allow-list is co-located with the module that owns it, exported through the module's `index.ts`:

```
src/modules/users/
  ...
  user.query-config.ts       # exports `usersQueryConfig: QueryConfig`
```

- **Why:** Keeps the config next to the resource that owns it (parallel to `user.schema.ts` / `user.types.ts`), avoids polluting `user.schema.ts` (which only carries Zod request/response schemas), and lets both the controller and unit tests import it by name.
- **Alternative considered:** Inline the config inside `user.controller.ts` — rejected. Inlining ties the config to the controller and makes it awkward to unit-test the config or to reuse the same allow-list in future admin views.

### D2. Field names in `sort` and `filter[...]` are camelCase, matching Prisma and the codebase

The `sort` and `filter[...]` field names accepted by this endpoint are the Prisma column names (`name`, `email`, `workspaceRoleId`, `status`, `createdAt`, `updatedAt`), not snake_case aliases.

- **Why:** The rest of the codebase (Prisma schema, DTOs, response bodies, `CreateUserRequestParamsSchema`) is camelCase. The shared `toPrismaFindArgs` uses the field name verbatim as the Prisma key, so any alias layer would require a per-resource mapping table that this change does not need. `docs/04-api/api-design.md` §5.3 does not mandate a naming convention.
- **Alternative considered:** Accept `workspace_role_id` and translate to `workspaceRoleId` inside the controller. Rejected — an extra translation layer with no benefit, and inconsistent with every other user-facing field name in the API.

### D3. Per-field filter value schemas in `usersQueryConfig`

Each filterable field declares an explicit Zod schema (used by the shared parser to validate/coerce a single value, and applied per element for the `in` operator):

| Field             | Operators                    | Value schema                        |
| ----------------- | ---------------------------- | ----------------------------------- |
| `name`            | `eq`, `ne`, `in`             | `z.string().min(1)`                 |
| `email`           | `eq`, `ne`, `in`             | `z.string().email()`                |
| `workspaceRoleId` | `eq`, `ne`, `in`             | `z.string().uuid()`                 |
| `status`          | `eq`, `ne`, `in`             | `z.nativeEnum(UserStatus)`          |
| `createdAt`       | `eq`, `gt`, `gte`, `lt`, `lte` | `z.coerce.date()`                 |
| `updatedAt`       | `eq`, `gt`, `gte`, `lt`, `lte` | `z.coerce.date()`                 |

Sortable fields: `name`, `email`, `createdAt`, `updatedAt`. Pagination: `defaultPageSize = 10`, `maxPageSize = 100`.

- **Why:** Strict schemas per field push validation into the shared parser, so the controller never needs its own guards; malformed values (e.g. `workspaceRoleId=abc`) surface as `ValidationError` with the offending parameter name. Using `z.coerce.date()` matches the "value coerced to the field's configured type" contract from the query-parameters spec.
- **Alternative considered:** A single permissive `z.string()` per field. Rejected — the shared parser would accept obviously invalid values (non-UUID role ids, bad statuses) and Prisma would either fail later with a generic error or silently return an empty page, both worse than a 400.

### D4. Service signature — pass `QueryOptions` through untouched; enforce authorization in the service

```ts
// user.interface.ts
export interface ListUsersResult {
  items: User[];       // the module's single `User` shape (safe fields + status)
  totalItems: number;
}

export interface IUserService {
  // existing:
  createUser(actor: ActorContext, params: CreateUserRequestParams): Promise<CreateUserResult>;
  // added:
  listUsers(actor: ActorContext, options: QueryOptions): Promise<ListUsersResult>;
}
```

The service:

1. Calls `authorizationGuard.authorize({ actor, scope: 'workspace', action: 'listUsers' })` — throws `AuthorizationError` (403) if denied.
2. Forwards `options` unchanged to `userRepository.findUsers(options)`.
3. Returns the repository result.

- **Why:** The query-parameters spec explicitly requires `QueryOptions` to flow through services untouched (transport- and persistence-neutral). Placing the authorization call in the service matches the pattern used by `createUser` today and keeps the controller free of business-rule enforcement.
- **Alternative considered:** Enforce authorization in the controller via a route-level guard middleware. Rejected — the codebase's current convention is guard-in-service; introducing a new middleware pattern is out of scope.

### D5. Repository uses one `$transaction` for `findMany` + `count`, reusing the module's existing safe `select` and `UserSchema`

```ts
// user.repository.ts (added)
async findUsers(options: QueryOptions): Promise<ListUsersResult> {
  const { skip, take, orderBy, where } = toPrismaFindArgs(options);
  const stableOrderBy = [...orderBy, { id: 'asc' as const }]; // deterministic tiebreaker (see D6)
  try {
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({ skip, take, orderBy: stableOrderBy, where, select: this.select }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map((u) => UserSchema.parse(u)), totalItems };
  } catch (error) {
    this.logError(error);
    throw mapPrismaError(error);
  }
}
```

`findUsers` reuses the existing private `select` (which already includes `status`) and the existing `UserSchema` — no new schema or select shape is introduced. This is the same shape every other repository method already returns.

- **Why:** Running `findMany` and `count` in a transaction guarantees the returned page and `totalItems` reflect the same snapshot — clients never see totals that disagree with the current page. Reusing the existing `select` (never `include`, never `select: undefined`) makes it structurally impossible to leak `password`, `activationTokenHash`, or `activationTokenExpiresAt` even if the schema grows more sensitive columns later; parsing through the single `UserSchema` gives the same safety guarantee in code review and tests, and keeps the module on one canonical user shape.
- **Alternative considered:** Sequential `await findMany; await count` — simpler, but exposes clients to inconsistent totals under concurrent writes. Cost is negligible for `$transaction([...])` reads.
- **Alternative considered:** A dedicated `listedUserSelect` / `ListedUserSchema` for the list endpoint — rejected. The module deliberately runs on one `UserSchema`; introducing a variant here would reintroduce exactly the inconsistency that was just consolidated away.

### D6. Deterministic pagination via a repository-layer tiebreaker on `id`

The repository appends `{ id: 'asc' }` as a final `orderBy` entry when it builds the Prisma call (see D5). This happens **after** `toPrismaFindArgs`, entirely below the parser boundary — the tiebreaker never appears in `QueryOptions`, in the API surface, or in `usersQueryConfig.sortableFields`.

- **Why the tiebreaker is needed:** PostgreSQL's `ORDER BY` is stable only between rows whose sort keys differ. Two cases break pagination without a tiebreaker:
  - Client omits `sort` — the parser normalizes to `sort: []`, so no `ORDER BY` is emitted and PostgreSQL is free to return rows in any order; two calls can return different orders, causing page overlap or gaps.
  - Client sends any non-unique sort field (`sort=name`, `sort=-createdAt` with a duplicate timestamp) — rows with equal keys have undefined relative order and can flip between page 1 and page 2.
  A stable trailing sort by the primary key resolves both cases: the client-visible ordering for their chosen sort is preserved, and only ties are resolved by `id`.
- **Why the repository, not the controller:** Ordering stability is a persistence concern (an artifact of `ORDER BY` semantics in PostgreSQL), not part of the API sort contract. Keeping the tiebreaker in the repository:
  - preserves `sortableFields = ['name', 'email', 'createdAt', 'updatedAt']` as the true, spec-matching API surface — the parser's allow-list stays the only gate on client sort input and continues to reject any client-sent `sort=id`;
  - keeps `QueryOptions` a faithful record of parsed client input, never mutated post-parse (the earlier draft of this design mutated it in the controller, which blurred that boundary);
  - places the coupling to `User.id` next to code that already references it (`getUserById`), where the repository owns the Prisma vocabulary anyway.
- **Impact on specs:** none — the `Collection response envelope` requirement doesn't constrain ordering when the client omits `sort`, and the tiebreaker is invisible in the response body.
- **Alternative considered:** Add `id` to `usersQueryConfig.sortableFields` so the tiebreaker can be injected through the parser. Rejected — it would broaden the client-facing sort surface beyond what the spec allows and beyond what the docs advertise, for no benefit; the parser guards *client* input, not server-internal correctness.
- **Alternative considered:** Do nothing and accept undefined tiebreaker order. Rejected — silent pagination bugs are the classic footgun for list endpoints and cost nothing to prevent.
- **Alternative considered:** Inject the tiebreaker in the controller (the earlier draft of this design). Rejected — it required mutating `QueryOptions` post-parse with a field the parser's allow-list would reject, mixing two boundaries that this design otherwise keeps cleanly separated.

### D7. Controller composition

```ts
private async listUsers(req, res, next) {
  try {
    const options = this.queryParser.parse(req.query, usersQueryConfig);
    const { items, totalItems } = await this.userService.listUsers(req.actor as ActorContext, options);
    const pagination = buildPaginationMeta(options.pagination.page, options.pagination.pageSize, totalItems);
    res.status(200).json({ data: items, meta: { pagination } });
  } catch (error) { next(error); }
}
```

Route registration adds `this.router.get('/', requireAuthenticationMiddleware, this.listUsers.bind(this))` in `registerRoutes()`.

- **Why:** Matches the existing controller shape (see `createUser`) — validate/parse, call the service, shape the envelope, forward errors. The controller does not mutate `QueryOptions` post-parse; the deterministic-pagination tiebreaker lives in the repository (see D6). `buildPaginationMeta` uses the client-facing `page`/`pageSize` from the parsed options, so meta always reflects what the client asked for.

### D8. DI wiring

`src/modules/users/index.ts` grows to inject the shared `queryParser` and the module's `usersQueryConfig` into the controller:

```ts
const usersController = new UsersController(userService, queryParser, usersQueryConfig);
```

- **Why:** Interface-based injection is the module convention; wiring here keeps controllers pure and unit-testable against `IQueryParser` and `IUserService` mocks.

### D9. Error mapping (per `docs/04-api/api-design.md` §4.2)

| Client scenario                                    | Error thrown                    | Status |
| -------------------------------------------------- | ------------------------------- | ------ |
| No / invalid auth token                            | `AuthenticationError` (middleware) | 401  |
| Actor's workspace role not in `listUsers` matrix   | `AuthorizationError` (guard)    | 403    |
| Invalid `page`/`pageSize`/`sort`/`filter[...]`     | `ValidationError` (parser)      | 400    |
| Unexpected Prisma / infrastructure failure         | `mapPrismaError` → `AppError`   | 500    |

- **Why:** All four branches already have first-class errors in `@/common/errors`; there is nothing new to invent. 404 is not applicable to a list endpoint — an empty match returns 200 with `data: []` and `totalItems: 0`.

## Risks / Trade-offs

- **[Reliance on Express/`qs` nesting shape]** The shared parser assumes `filter` arrives as a nested object; a future middleware change that swapped `qs` for `simple` parsing would silently break every list endpoint. → Mitigation: this risk is owned by the shared `query-parameters` capability, not this change; integration tests here exercise `filter[field][op]=value` end-to-end and would catch a regression.
- **[Tiebreaker sort by `id` couples the repository to the `User.id` primary key column]** If `User.id` were ever removed or renamed, the tiebreaker would silently break. → Mitigation: `User.id` is a Prisma-managed UUID primary key with no plan to remove, and the repository already references it directly elsewhere (`getUserById`), so the coupling is not new. An integration test failure would surface any mismatch immediately.
- **[Adding `listUsers` to the authorization matrix with three roles effectively opens the endpoint to every authenticated workspace member]** Any leakage risk from the users list itself is bounded by D5's `select` (no credentials exposed) and the response schema. → Mitigation: if a future policy tightens listing to Owner/Admin only, the change is a one-line matrix edit with no code impact.
- **[`z.coerce.date()` accepts a broader input set than pure ISO 8601]** e.g. `2026-01-01` (no time) coerces fine. → Accepted: matches the query-parameters capability's "coerce to configured type" contract, and any string `new Date()` can parse is unambiguous enough for range filters. Callers get a clear 400 for genuinely malformed values.
- **[Deterministic pagination requires that `findMany` + `count` see the same snapshot]** `$transaction([...])` guarantees this at the DB level; without it, concurrent inserts could yield `data.length > pageSize` or a moving `totalItems`. → Addressed by D5.

## Open Questions

- Whether to expose an admin-only version of this endpoint later that surfaces additional non-safe fields (e.g. `status = disabled`, `lastLoginAt`) — deferrable, does not affect the specs or the tasks in this change.
