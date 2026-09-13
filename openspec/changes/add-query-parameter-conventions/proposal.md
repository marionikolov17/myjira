## Why

Every list endpoint in the API design (`GET /projects`, `GET /projects/{projectId}/issues`, `GET /issues/{issueId}/subtasks`, `GET /projects/{projectId}/members`) is specified to "support pagination, filtering and sorting" using the shared Query Parameter Conventions in `docs/04-api/api-design.md` §5, and every collection response must carry a `meta.pagination` block (§6.2). None of this exists in the codebase yet. This is the last cross-cutting concern before functional list features begin: building it now gives every upcoming list endpoint a single, consistent, tested way to parse `page`/`pageSize`/`sort`/`filter[...]` and to shape pagination metadata, instead of each controller re-implementing (and drifting from) the convention.

## What Changes

- Introduce a reusable, resource-agnostic query layer under `src/common/query/`, split across the three layer boundaries so no piece leaks Express or Prisma into the wrong layer:
  - **Parse + validate** (`page`, `pageSize`, `sort`, `filter[field]`, `filter[field][operator]`) from a raw request-query object into a normalized, validated `QueryOptions` domain object. Depends only on Zod and the existing error taxonomy — no Express, no Prisma.
  - **Normalized domain representation** — a plain `QueryOptions` type (pagination + sort list + filter list) that services pass through untouched, agnostic of HTTP and persistence.
  - **Pagination meta builder** — computes `{ page, pageSize, totalItems, totalPages }` for the collection response envelope's `meta.pagination`.
  - **Persistence mapper** — translates `QueryOptions` into Prisma arguments (`skip`, `take`, `orderBy`, `where`). This is the only Prisma-aware piece and stays isolated at the repository boundary.
- Make the parser **config-driven per resource**: it accepts a `QueryConfig` allow-list (sortable fields; filterable fields with their permitted operators and a Zod value schema per field; default and max `pageSize`) so the shared code stays generic while each resource controls what is exposed.
- Enforce the conventions and their guardrails: `page`/`pageSize` defaults (1 / 10) and coercion, a `maxPageSize` cap, `-` prefix for descending sort, the supported operators (`eq` default, `ne`, `gt`, `gte`, `lt`, `lte`, `in`), and comma-separated values for `in`.
- Reject unknown/unsupported sort fields, filter fields, operators, or malformed values with the existing `ValidationError` (via `map-zod-error`), so failures surface through the unified error model.
- Expose the parser behind an interface (`IQueryParser`) with DI wiring in `index.ts`, following the facade + interface-injection conventions in `AGENTS.md`.
- Cover all pieces with unit tests. **This change does NOT wire the query layer into any controller or repository** — no compatible list routes exist yet. Integration into routes is deferred to the functional changes that add those endpoints.

## Out of Scope

- Wiring the parser, meta builder, or Prisma mapper into any controller/route or repository (deferred to the functional list-endpoint changes).
- Per-resource `QueryConfig` definitions for concrete resources (Projects, Issues, Subtasks, Members) — those belong to the changes that add those endpoints.
- Cursor-based pagination, full-text search, and any operator beyond those listed in §5.3.

## Capabilities

### New Capabilities

- `query-parameters`: The shared query-parameter contract for list endpoints — pagination (`page`/`pageSize` with defaults and a max cap), sorting (`sort` with `-` descending prefix), and filtering (`filter[field]` / `filter[field][operator]` over the supported operator set), parsed against a per-resource allow-list into a normalized `QueryOptions` object, with validation failures raised as `ValidationError`, a pagination-metadata builder for the collection response envelope, and a persistence mapper to Prisma query arguments.

### Modified Capabilities

<!-- None. No existing spec covers query parameters, and no existing behavior changes;
     the query layer is additive and not yet consumed by any route. -->

## Impact

- **New code**: `server/src/common/query/` — `query.types.ts` (`QueryOptions`, `FilterOperator`, `SortDirection`, `QueryConfig`), `query.interface.ts` (`IQueryParser`), `pagination.schema.ts` / `sort.schema.ts` (Zod), `query-parser.ts` (configurable parser), `pagination-meta.ts` (meta builder), `prisma-query-mapper.ts` (`QueryOptions` → Prisma args), and `index.ts` (DI wiring/exports).
- **Consumes**: Zod, and the existing `ValidationError` + `map-zod-error` (`@/common/errors`, `@/common/utils`). No new dependencies.
- **Downstream**: future functional list endpoints (Projects, Issues, Subtasks, Project Members) will supply a `QueryConfig`, call the parser in their controller, pass `QueryOptions` through the service, and use the Prisma mapper in their repository. Those endpoints are out of scope for this change.
- **API**: implements `docs/04-api/api-design.md` §5 (Query Parameter Conventions) and the `meta.pagination` shape from §6.2. No route surface is added by this change.
- **Tests**: unit tests under `tests/unit/common/query/` for the parser (pagination/sort/filter parsing, defaults, caps, operator handling, and validation errors), the pagination-meta builder, and the Prisma mapper, following the project's unit-test conventions. No integration surface until a route consumes it.
