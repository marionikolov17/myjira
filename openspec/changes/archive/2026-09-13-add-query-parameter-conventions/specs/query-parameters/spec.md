## Purpose

Defines the shared query-parameter contract for list endpoints: how pagination, sorting, and filtering request parameters are interpreted, validated against a per-resource allow-list, normalized into a consistent shape, translated into persistence query arguments, and reported back through collection pagination metadata — so every list endpoint behaves consistently and rejects invalid input uniformly.

## ADDED Requirements

### Requirement: Per-resource allow-list governs parsing

Query-parameter parsing SHALL be governed by a per-resource configuration that declares which fields are sortable, which fields are filterable and the operators permitted for each, the value type expected for each filterable field, and the default and maximum page size. Any field or operator not declared in the configuration SHALL be rejected. The parsing behavior itself SHALL be resource-agnostic and depend only on the supplied configuration.

#### Scenario: Field absent from configuration is rejected

- **WHEN** a request references a sort or filter field that the resource configuration does not declare
- **THEN** the query is rejected as invalid
- **AND** no normalized query options are produced for that request

#### Scenario: Same parser reused across resources

- **WHEN** two different resource configurations are supplied to the parser
- **THEN** each request is parsed and validated according to the configuration supplied for that resource, with no resource-specific logic embedded in the parser

### Requirement: Pagination parameters

The capability SHALL interpret a `page` and a `pageSize` parameter as positive integers. When `page` is omitted it SHALL default to 1, and when `pageSize` is omitted it SHALL default to the configured default (10 unless the resource configuration overrides it). Numeric string inputs SHALL be coerced to integers. A `pageSize` greater than the configured maximum SHALL be rejected. Non-integer, zero, or negative values for either parameter SHALL be rejected.

#### Scenario: Defaults applied when omitted

- **WHEN** a request provides neither `page` nor `pageSize`
- **THEN** the normalized pagination is `page` = 1 and `pageSize` = the configured default

#### Scenario: Numeric strings are coerced

- **WHEN** a request provides `page=2` and `pageSize=25` as strings
- **THEN** the normalized pagination is the integers `page` = 2 and `pageSize` = 25

#### Scenario: Page size above the maximum is rejected

- **WHEN** a request provides a `pageSize` greater than the configured maximum
- **THEN** the query is rejected as invalid

#### Scenario: Non-positive or non-integer pagination is rejected

- **WHEN** a request provides `page` or `pageSize` that is zero, negative, or not an integer
- **THEN** the query is rejected as invalid

### Requirement: Sorting parameter

The capability SHALL interpret a `sort` parameter as an ordered list of one or more fields separated by commas. Each field prefixed with `-` SHALL sort descending; otherwise it SHALL sort ascending. Every referenced field SHALL be one of the configured sortable fields; a field that is not sortable SHALL be rejected. When `sort` is omitted, the normalized sort SHALL be empty.

#### Scenario: Descending prefix interpreted

- **WHEN** a request provides `sort=-createdAt`
- **THEN** the normalized sort contains the field `createdAt` with descending direction

#### Scenario: Multiple sort fields preserve order

- **WHEN** a request provides `sort=priority,-createdAt`
- **THEN** the normalized sort is an ordered list of `priority` ascending followed by `createdAt` descending

#### Scenario: Non-sortable field is rejected

- **WHEN** a request provides a `sort` field that is not declared sortable in the configuration
- **THEN** the query is rejected as invalid

### Requirement: Filtering parameters

The capability SHALL interpret filter parameters in the forms `filter[field]=value` and `filter[field][operator]=value`. When no operator is given, the operator SHALL default to `eq`. The supported operators SHALL be `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, and `in`. The `in` operator SHALL interpret its value as a comma-separated list of values. Each filtered field SHALL be one of the configured filterable fields, the operator SHALL be one permitted for that field, and the value SHALL be validated and coerced to the field's configured type. A field that is not filterable, an operator not permitted for the field, or a value that fails validation SHALL be rejected.

#### Scenario: Operator defaults to equality

- **WHEN** a request provides `filter[status]=open`
- **THEN** the normalized filters contain field `status`, operator `eq`, and value `open`

#### Scenario: Explicit operator interpreted

- **WHEN** a request provides `filter[createdAt][gte]=2025-01-01T00:00:00Z`
- **THEN** the normalized filters contain field `createdAt`, operator `gte`, and the coerced value

#### Scenario: In operator splits comma-separated values

- **WHEN** a request provides `filter[priority][in]=high,medium`
- **THEN** the normalized filters contain field `priority`, operator `in`, and the list of values `high` and `medium`

#### Scenario: Non-filterable field is rejected

- **WHEN** a request filters on a field not declared filterable in the configuration
- **THEN** the query is rejected as invalid

#### Scenario: Operator not permitted for the field is rejected

- **WHEN** a request uses an operator that the configuration does not permit for the given field
- **THEN** the query is rejected as invalid

#### Scenario: Value failing type validation is rejected

- **WHEN** a filter value cannot be coerced to the field's configured type
- **THEN** the query is rejected as invalid

### Requirement: Invalid queries surface through the unified error model

WHEN a query is rejected as invalid for any reason, THEN the capability SHALL raise a validation error consistent with the API's unified error model, identifying the offending parameter(s). It SHALL NOT silently drop, ignore, or coerce an invalid parameter into a valid one.

#### Scenario: Validation error identifies the offending parameter

- **WHEN** a request contains an invalid query parameter
- **THEN** a validation error is raised that names the offending parameter
- **AND** the invalid parameter is not silently ignored

### Requirement: Normalized query options output

On success, the capability SHALL produce a single normalized query-options value containing the resolved pagination (page and page size), the ordered list of sort fields with directions, and the list of filters (field, operator, value). This normalized value SHALL be independent of the transport (HTTP request) and of any persistence technology, so that it can be passed unchanged through application services.

#### Scenario: Successful parse yields normalized options

- **WHEN** a valid request with pagination, sorting, and filtering is parsed
- **THEN** the result is a normalized query-options value carrying the resolved pagination, ordered sort list, and filter list
- **AND** the value contains no transport- or persistence-specific data

### Requirement: Pagination metadata computation

Given the resolved page, page size, and the total number of matching items, the capability SHALL compute pagination metadata containing `page`, `pageSize`, `totalItems`, and `totalPages`, where `totalPages` is the total item count divided by the page size, rounded up. When there are zero matching items, `totalPages` SHALL be 0.

#### Scenario: Total pages rounded up

- **WHEN** metadata is computed for page size 10 and 120 total items
- **THEN** the metadata reports `totalItems` = 120 and `totalPages` = 12

#### Scenario: Partial final page counted

- **WHEN** metadata is computed for page size 10 and 25 total items
- **THEN** the metadata reports `totalPages` = 3

#### Scenario: Empty result set

- **WHEN** metadata is computed for 0 total items
- **THEN** the metadata reports `totalItems` = 0 and `totalPages` = 0

### Requirement: Translation to persistence query arguments

The capability SHALL translate normalized query options into equivalent persistence query arguments: an offset equal to `(page - 1) * pageSize`, a limit equal to `pageSize`, an ordering that preserves the sort list and its directions, and filter conditions that preserve each filter's field, operator, and value semantics. Applying these arguments SHALL yield the page of results described by the original query.

#### Scenario: Offset derived from page and page size

- **WHEN** normalized options specify page 3 and page size 10 are translated
- **THEN** the persistence arguments request an offset of 20 and a limit of 10

#### Scenario: Sort order preserved

- **WHEN** normalized options with an ordered sort list are translated
- **THEN** the persistence ordering matches the sort list order and directions

#### Scenario: Filter operators preserved

- **WHEN** normalized filters using the supported operators are translated
- **THEN** each persistence filter condition preserves the field, operator semantics, and value of the corresponding normalized filter
