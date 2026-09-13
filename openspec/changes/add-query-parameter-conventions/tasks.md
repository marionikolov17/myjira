## 1. Types and constants

- [x] 1.1 Create `server/src/common/query/query.types.ts` defining `FilterOperator` (`eq | ne | gt | gte | lt | lte | in`), `SortDirection` (`asc | desc`), `QueryOptions` (pagination + ordered `sort[]` + `filters[]`), `FilterFieldConfig` (`operators`, Zod `schema`), and `QueryConfig` (`sortableFields`, `filterableFields`, optional `defaultPageSize`/`maxPageSize`) per design D3/D5; verify it compiles with `tsc --noEmit -p tsconfig.json` and exports only type-level declarations (no runtime values).
- [x] 1.2 Create `server/src/common/query/query.constants.ts` exporting `DEFAULT_PAGE_SIZE = 10` and `MAX_PAGE_SIZE = 100` per design D8; verify it type-checks and is importable from other modules.

## 2. Schemas

- [x] 2.1 Create `server/src/common/query/pagination.schema.ts` exporting a `paginationSchema(config)` factory (Zod) that coerces `page`/`pageSize` to positive integers, defaults `page` to 1 and `pageSize` to `config.defaultPageSize ?? DEFAULT_PAGE_SIZE`, and caps `pageSize` at `config.maxPageSize ?? MAX_PAGE_SIZE` per design D4; verify via the parser unit tests in 7.2 (exercised through `parse`).
- [x] 2.2 Create `server/src/common/query/sort.schema.ts` exporting a helper that parses a single sort token into `{ field, direction }` (leading `-` → `desc`) and validates the field against an allow-list per design D4; verify via the parser unit tests in 7.2 (exercised through `parse`).

## 3. Parser

- [x] 3.1 Create `server/src/common/query/query.interface.ts` defining `IQueryParser` with `parse(rawQuery: unknown, config: QueryConfig): QueryOptions`; verify it compiles.
- [x] 3.2 Create `server/src/common/query/query-parser.ts` implementing `QueryParser` (parse pagination via 2.1, split/validate `sort` via 2.2, and walk the nested `filter` object: resolve field → operator (`eq` default) → value, whitelist field+operator against `config.filterableFields`, coerce values with each field's Zod `schema`, split `in` on commas) producing a normalized `QueryOptions` per design D4/D5; guard non-object inputs at each nesting level with `isPlainObject`; verify with the parser unit tests in 7.2.
- [x] 3.3 In `query-parser.ts`, accumulate every validation problem and throw a single `ValidationError` whose `details.fields[].name` is the client-facing key (`pageSize`, `sort`, `filter[status]`, `filter[createdAt][gte]`), routing Zod issues through `mapZodError` per design D6; verify with the accumulation unit tests in 7.3.

## 4. Pagination metadata

- [x] 4.1 Create `server/src/common/query/pagination-meta.ts` exporting `buildPaginationMeta(page, pageSize, totalItems)` returning `{ page, pageSize, totalItems, totalPages }` with `totalPages = ceil(totalItems / pageSize)` and `0` when `totalItems` is `0` per spec; verify with the meta unit tests in 7.4.

## 5. Persistence mapper

- [x] 5.1 Create `server/src/common/query/prisma-query-mapper.ts` exporting `toPrismaFindArgs(options)` returning `{ skip: (page-1)*pageSize, take: pageSize, orderBy: [...], where: {...} }` as plain objects, using an operator→keyword table (`eq`→`equals`, `ne`→`not`, `in`→`in`, `gt`/`gte`/`lt`/`lte` unchanged) and preserving sort order, per design D7 (no `@prisma/client` import); verify with the mapper unit tests in 7.5.

## 6. Wiring

- [x] 6.1 Create `server/src/common/query/index.ts` exporting the `queryParser` singleton (`new QueryParser()`), `buildPaginationMeta`, `toPrismaFindArgs`, the constants, and the public types/interface; verify the barrel imports cleanly with `tsc --noEmit -p tsconfig.json`. Do NOT mount, import, or reference the query layer from any controller, service, or repository (proposal — Out of Scope).

## 7. Unit tests

> `pagination.schema.ts` and `sort.schema.ts` are internal helpers of the parser, so their behavior (pagination defaults/coercion/cap, sort prefix/order/allow-list) is exercised through the public `QueryParser.parse` in 7.2 rather than in isolation.

- [x] 7.1 Add `server/tests/unit/common/query/query.fixtures.ts` with a representative `QueryConfig` (a couple of sortable fields; filterable fields with per-field operators and scalar Zod schemas — string, number, date) and helper builders for raw `qs`-parsed query objects (flat filter, `[operator]` nesting, comma `in` lists), following the unit-test conventions; verify fixtures type-check against the domain types.
- [x] 7.2 Add `query-parser.test.ts` covering the parser's public behavior via `parse`: pagination defaults when omitted, numeric-string coercion, rejection of zero/negative/non-integer and above the max cap; sort ascending/descending prefix, multiple comma-separated fields preserving order, empty sort when omitted, rejection of non-sortable fields; full valid parse → normalized `QueryOptions`; `eq` default; explicit operators; `in` comma-splitting; and rejection of non-filterable field, disallowed operator, and un-coercible value; verify `npm run test:unit` passes.
- [x] 7.3 Add to `query-parser.test.ts` coverage of the accumulation behavior (design D6): a request with several invalid parameters throws a single `ValidationError` whose `details.fields` names every offending client-facing key (`pageSize`, `sort`, `filter[status]`, `filter[createdAt][gte]`); verify `npm run test:unit` passes.
- [x] 7.4 Add `pagination-meta.test.ts` covering exact division (120/10 → 12), partial final page (25/10 → 3), and zero items (→ 0); verify `npm run test:unit` passes.
- [x] 7.5 Add `prisma-query-mapper.test.ts` covering offset/limit derivation (page 3, size 10 → skip 20, take 10), sort-order/direction preservation, and each of the seven operators mapping to the correct keyword; verify `npm run test:unit` passes.

## 8. Verification

- [x] 8.1 Run `npm run prettier`, `npm run lint`, and `npm run test:unit` — all pass; confirm compilation of the new module is clean via `tsc --noEmit -p tsconfig.json`.
- [x] 8.2 Run `openspec validate add-query-parameter-conventions --strict` and confirm the change is valid.
