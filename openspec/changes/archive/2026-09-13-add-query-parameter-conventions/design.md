## Context

See `proposal.md` — Why, and `specs/query-parameters/spec.md` for the behavior contract.

Constraints that shape this design:

- The codebase uses interface-first DI with singletons wired in each module's `index.ts`, infrastructure hidden behind facades in `common/`, Zod for validation, and typed errors from `@/common/errors` (see `server/AGENTS.md`).
- `ValidationError` already exists (`VALIDATION_ERROR`, 400) and carries `details.fields: { name, message }[]`. `mapZodError` converts a `ZodError` into that shape, collecting the first message per field and expanding `unrecognized_keys`.
- Express 5 parses the request query string with `qs`, so `?filter[status]=open&filter[createdAt][gte]=...` arrives at `req.query` as a **nested plain object** (`{ filter: { status: 'open', createdAt: { gte: '...' } } }`), and repeated/`in` values arrive as strings. The parser therefore consumes an already-parsed plain object, not a raw string.
- This change adds no routes and wires nothing into controllers or repositories (proposal — Out of Scope). Everything below is built and unit-tested in isolation.

## Goals / Non-Goals

**Goals:**

- A resource-agnostic, config-driven parser that turns a raw query object into a validated, normalized `QueryOptions`, raising `ValidationError` on any invalid input.
- A clean separation across the three layer boundaries so no piece leaks transport (Express) or persistence (Prisma) concerns into the wrong layer.
- Strong typing for operators, sort direction, and per-resource configuration so call sites and configs are compile-time checked.
- Pure, synchronous, dependency-free units that are trivial to unit-test.

**Non-Goals:**

- Wiring any of this into a controller, service, or repository, or defining concrete per-resource `QueryConfig`s (future functional changes).
- Cursor-based pagination, full-text search, `OR`/nested boolean filter groups, or operators beyond §5.3.
- Re-implementing query-string parsing — the parser trusts Express/`qs` to have produced the nested object.

## Decisions

### D1: Location and file layout — a new `common/query/` folder

Query handling is a cross-cutting concern reused by every list endpoint, so it lives in `common/` alongside `authorization/`, `token-service/`, etc.:

```
common/query/
  query.types.ts             # FilterOperator, SortDirection, QueryOptions, QueryConfig
  query.constants.ts         # DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
  query.interface.ts         # IQueryParser
  pagination.schema.ts       # Zod schema for page/pageSize (defaults, coercion, max cap)
  sort.schema.ts             # Zod helpers for a single sort token
  query-parser.ts            # QueryParser implements IQueryParser
  pagination-meta.ts         # buildPaginationMeta(...)
  prisma-query-mapper.ts     # toPrismaFindArgs(options)
  index.ts                   # exports singleton `queryParser` + helpers + types/interface
```

- **Why:** Matches the existing `common/` facade + `index.ts` singleton convention; keeps the concern in one discoverable place.

### D2: Split into three units across the layer boundaries

Three independent units, each owned by a different layer, wired together only by the eventual (future) route:

1. **`QueryParser`** (controller boundary): `parse(rawQuery, config) → QueryOptions`. Depends on Zod + errors only.
2. **`buildPaginationMeta`** (controller/response boundary): `(page, pageSize, totalItems) → { page, pageSize, totalItems, totalPages }`.
3. **`toPrismaFindArgs`** (repository boundary): `QueryOptions → { skip, take, orderBy, where }`.

`QueryOptions` (D5) is the shared currency that services pass through untouched.

- **Why:** The spec separates "parse", "compute metadata", and "translate to persistence"; keeping them as separate pure functions means the controller never imports Prisma vocabulary and the repository never imports transport concerns. Each is independently testable.
- **Alternative considered:** One `QueryService` class doing all three — rejected; it would couple the transport-facing parser to the Prisma-facing mapper and blur the layer boundary.

### D3: Config-driven parser; config passed per call, not injected

The parser is stateless; the per-resource allow-list is passed as an argument to `parse`, and the singleton is shared across all resources:

```ts
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';

export interface FilterFieldConfig {
  operators: FilterOperator[];   // operators permitted for this field
  schema: ZodType;               // validates/coerces a single scalar value
}

export interface QueryConfig {
  sortableFields: string[];
  filterableFields: Record<string, FilterFieldConfig>;
  defaultPageSize?: number;      // falls back to 10
  maxPageSize?: number;          // falls back to a shared cap (100)
}

export interface IQueryParser {
  parse(rawQuery: unknown, config: QueryConfig): QueryOptions;
}
```

- **Why:** There are many resource configs (one per list endpoint), unlike the single authorization matrix, so injecting one config into the constructor doesn't fit. Passing config per call keeps a single reusable `queryParser` singleton while letting each resource declare its own surface. The parser stays generic — no resource-specific branches.
- **Alternative considered:** A `createQueryParser(config)` factory returning a bound parser — viable, but the per-call form keeps DI simple (one exported singleton) and mirrors how a controller already has the config in hand.

### D4: Pagination and sort via Zod; filtering parsed imperatively then Zod-validated per value

- **Pagination** (`pagination.schema.ts`): a Zod schema using `z.coerce.number().int().positive()`, `page` defaulting to 1, `pageSize` defaulting to `config.defaultPageSize` and `.max(config.maxPageSize)`. Built as a factory `paginationSchema(config)` so the cap is config-driven.
- **Sort**: split `sort` on commas, derive direction from a leading `-`, and check each field against `config.sortableFields`. A tiny Zod refinement validates the field name; unknown fields produce an issue.
- **Filtering**: the keys are dynamic (`filter[field][op]`), so a static Zod object cannot express them. Walk the parsed `filter` object: for each `field`, confirm it is in `config.filterableFields`; normalize the value form (`filter[field]=v` → `eq`; `filter[field][op]=v` → `op`); confirm `op` is in that field's `operators`; then validate/coerce the value with the field's `schema` (for `in`, split on commas and validate each element). Anything failing becomes a collected issue.

- **Why:** Zod cleanly handles the fixed-shape pagination/sort with coercion and defaults, matching the codebase's validation style. Filtering's dynamic keys and per-field operator/value rules are clearer as an explicit walk that still delegates value validation to Zod (`config`-supplied schemas), keeping type coercion consistent.
- **Alternative considered:** A fully dynamic `z.record` for filters — awkward for the `field`→`operator`→`value` nesting and for per-field operator whitelists; harder to produce precise field-named errors.

### D5: `QueryOptions` — transport- and persistence-neutral normalized shape

```ts
export type SortDirection = 'asc' | 'desc';

export interface QueryOptions {
  pagination: { page: number; pageSize: number };
  sort: { field: string; direction: SortDirection }[];         // ordered
  filters: { field: string; operator: FilterOperator; value: unknown }[];
}
```

- **Why:** Plain data with no Express or Prisma types, so services accept and forward it unchanged (spec: "independent of the transport and of any persistence technology"). Ordered `sort`/`filters` arrays preserve request order and allow the same field with multiple operators (e.g. `gte` + `lte` range).

### D6: Accumulate all validation problems into a single `ValidationError`

Parsing collects every problem (bad pagination, unknown sort field, non-filterable field, disallowed operator, un-coercible value) and raises one `ValidationError` whose `details.fields[].name` is the offending parameter as the client sent it (`pageSize`, `sort`, `filter[status]`, `filter[createdAt][gte]`). Zod-sourced issues go through `mapZodError`; imperative issues are appended in the same `{ name, message }` shape.

- **Why:** Matches the spec ("names the offending parameter", "not silently ignored") and the app's unified error model; one round-trip surfaces all mistakes. Using the bracketed client-facing key makes errors actionable.

### D7: `toPrismaFindArgs` emits plain Prisma-shaped objects without importing Prisma

```ts
// eq→equals, ne→not, in→in, gt/gte/lt/lte→same key
toPrismaFindArgs(options) => {
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: sort.map(s => ({ [s.field]: s.direction })),   // ordered
  where: buildWhere(filters),                              // { field: { equals|not|gt|...: value } }
}
```

- **Why:** The Prisma filter DSL is just plain objects, so the mapper stays a pure function with no `@prisma/client` import — fully unit-testable and the single place that knows the operator→Prisma-keyword mapping. If the ORM ever changes, only this file changes (spec: mapping preserves offset/limit/order/operator semantics).
- **Alternative considered:** Building `Prisma.<Model>WhereInput`-typed objects — would couple the shared mapper to specific generated model types; rejected in favor of a generic structural return that repositories spread into their typed query.

### D8: Shared defaults

`defaultPageSize = 10` (§5.1) and a shared `maxPageSize = 100` when a config omits it. Exposed as named constants (`DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`) in their own `query.constants.ts` so tests and configs reference them.

- **Why:** §5.1 fixes the default; the max cap is a safety guard not specified by the doc, so a sensible shared default that resources can override. Constants are runtime values, so they live in a dedicated `query.constants.ts` rather than `query.types.ts`, which stays purely type-level (no runtime exports).

## Risks / Trade-offs

- **Reliance on Express/`qs` nesting shape** → The parser assumes `filter` arrives as a nested object. Mitigation: `parse` defends with `isPlainObject` on `rawQuery` and each nesting level, treating malformed shapes as validation errors; unit tests feed representative `qs`-parsed inputs (flat value, `[op]` nesting, `in` lists).
- **Prisma-shaped `where` is structurally, not nominally, typed** → A wrong operator keyword wouldn't be caught by Prisma's types at the mapper boundary. Mitigation: the operator→keyword mapping is a single small table with exhaustive unit tests over all seven operators.
- **Per-field value correctness is delegated to config authors** → A resource that supplies a loose `schema` could accept unintended values. Mitigation: `QueryConfig` typing forces an explicit Zod schema per filterable field; documented expectation that configs use strict scalar schemas.
- **`in` value splitting on commas** → Values containing literal commas cannot be expressed. Accepted for now (matches §5.3's simple convention); revisit only if a real field needs it.
- **Deferred integration** → Because nothing consumes these units yet, integration mismatches (e.g. a repository's `select`/`where` typing) won't surface until the first list endpoint. Mitigation: the mapper's structural return is designed to spread into a typed Prisma call; the first consuming change validates end-to-end.
