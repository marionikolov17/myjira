## ADDED Requirements

### Requirement: Authorized user listing

The system SHALL allow an authenticated actor whose workspace role is among the `listUsers` action's allowed roles — Workspace Owner, Workspace Admin, or Developer — to list workspace users. The acting actor SHALL be derived from the authenticated actor context, and the authorization decision SHALL be made through the declarative authorization capability against the `workspace` scope, so that any future change to allowed roles is driven by the matrix alone.

#### Scenario: Workspace Owner lists users

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid users-list request
- **THEN** the system returns the requested page of workspace users

#### Scenario: Workspace Admin lists users

- **WHEN** an authenticated actor with the Workspace Admin role submits a valid users-list request
- **THEN** the system returns the requested page of workspace users

#### Scenario: Developer lists users

- **WHEN** an authenticated actor with the Developer workspace role submits a valid users-list request
- **THEN** the system returns the requested page of workspace users

#### Scenario: Workspace role not permitted for the action is forbidden

- **WHEN** an authenticated actor whose workspace role is not among the `listUsers` action's allowed roles submits a users-list request
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no user data is returned

#### Scenario: Unauthenticated request is rejected

- **WHEN** a users-list request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no user data is returned

### Requirement: Query-parameter contract for user listing

The users-list request SHALL interpret its `page`, `pageSize`, `sort`, and `filter[...]` parameters through the shared query-parameter contract, governed by a users configuration that declares:

- **Sortable fields**: `name`, `email`, `createdAt`, `updatedAt`.
- **Filterable fields and operators**:
  - `name`, `email`, `workspaceRoleId`, `status`: operators `eq`, `ne`, `in`.
  - `createdAt`, `updatedAt`: operators `eq`, `gt`, `gte`, `lt`, `lte`.
- **Pagination**: default `pageSize` = 10, maximum `pageSize` = 100.

Any sort field, filter field, operator, or value not permitted by this configuration SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. The users-list behavior SHALL NOT introduce parsing or coercion rules beyond those defined by the shared query-parameter contract.

#### Scenario: Sort by an allowed field with descending prefix

- **WHEN** an authorized actor requests the users list with `sort=-createdAt`
- **THEN** the returned page is ordered by `createdAt` descending

#### Scenario: Filter by an allowed field with the default equality operator

- **WHEN** an authorized actor requests the users list with `filter[status]=pending`
- **THEN** the returned page contains only users whose status equals `pending`

#### Scenario: Filter with the `in` operator

- **WHEN** an authorized actor requests the users list with `filter[workspaceRoleId][in]=<roleIdA>,<roleIdB>`
- **THEN** the returned page contains only users whose `workspaceRoleId` is either `<roleIdA>` or `<roleIdB>`

#### Scenario: Filter with a range operator on a timestamp field

- **WHEN** an authorized actor requests the users list with `filter[createdAt][gte]=2026-01-01T00:00:00Z`
- **THEN** the returned page contains only users whose `createdAt` is on or after that instant

#### Scenario: Sort field not in the allow-list is rejected

- **WHEN** an authorized actor requests the users list sorting by a field not declared sortable in the users configuration
- **THEN** the request is rejected with a validation error identifying the offending sort parameter
- **AND** no user data is returned

#### Scenario: Filter field not in the allow-list is rejected

- **WHEN** an authorized actor requests the users list filtering on a field not declared filterable in the users configuration
- **THEN** the request is rejected with a validation error identifying the offending filter parameter
- **AND** no user data is returned

#### Scenario: Operator not permitted for the filtered field is rejected

- **WHEN** an authorized actor requests the users list with an operator that the users configuration does not permit for the given filterable field
- **THEN** the request is rejected with a validation error identifying the offending filter parameter
- **AND** no user data is returned

#### Scenario: Page size above the users maximum is rejected

- **WHEN** an authorized actor requests the users list with `pageSize` greater than 100
- **THEN** the request is rejected with a validation error identifying the offending `pageSize` parameter
- **AND** no user data is returned

#### Scenario: Pagination defaults applied when omitted

- **WHEN** an authorized actor requests the users list without `page` or `pageSize`
- **THEN** the response is computed for `page` = 1 and `pageSize` = 10

### Requirement: Collection response envelope for user list

On success the system SHALL return the users-list response as a collection envelope containing a `data` array of user resources and a `meta.pagination` object with `page`, `pageSize`, `totalItems`, and `totalPages`, where `totalPages` is the total item count divided by the page size, rounded up, and is 0 when there are no matching users. The envelope SHALL be returned with a success status.

#### Scenario: Successful list returns data array and pagination metadata

- **WHEN** an authorized actor submits a valid users-list request
- **THEN** the system responds with a success status and a body containing a `data` array of user resources and a `meta.pagination` object reporting `page`, `pageSize`, `totalItems`, and `totalPages`

#### Scenario: Partial final page reflected in pagination metadata

- **WHEN** an authorized actor lists users with `pageSize` = 10 against a matching set of 25 users
- **THEN** the response reports `totalItems` = 25 and `totalPages` = 3

#### Scenario: Empty result returns empty data and zeroed totals

- **WHEN** an authorized actor lists users and no user matches the request
- **THEN** the response contains an empty `data` array and reports `totalItems` = 0 and `totalPages` = 0

### Requirement: Safe fields only in user list items

Each user resource returned in the users-list `data` array SHALL contain only the non-sensitive user fields: `id`, `name`, `email`, `workspaceRoleId`, `status`, and creation/update timestamps. The response SHALL NOT expose any credential material, activation material, or password-related field for any listed user — including but not limited to a password, a password hash, an activation token, an activation-token hash, or an activation-token expiry.

#### Scenario: Listed users expose only safe fields

- **WHEN** an authorized actor submits a valid users-list request
- **THEN** every user in the `data` array contains `id`, `name`, `email`, `workspaceRoleId`, `status`, and creation/update timestamps

#### Scenario: Credential and activation fields are never exposed

- **WHEN** an authorized actor submits a valid users-list request
- **THEN** no user in the `data` array contains a password, password hash, activation token, activation-token hash, or activation-token expiry
