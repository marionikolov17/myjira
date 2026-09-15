## Purpose

Defines how workspace users are created by privileged operators, ensuring only authorized roles can onboard members, that assigned roles cannot escalate to Workspace Owner, that identities are unique, and that new accounts are provisioned without a usable password and instead receive a single-use, expiring activation token to set their own credentials.

## Requirements

### Requirement: Authorized user creation

The system SHALL allow only an authenticated actor whose workspace role is Workspace Owner or Workspace Admin to create a new workspace user. The acting user SHALL be derived from the authenticated actor context and never from client-provided identity fields.

#### Scenario: Workspace Owner creates a user

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid user-creation request
- **THEN** the system creates the user and returns the created user resource

#### Scenario: Workspace Admin creates a user

- **WHEN** an authenticated actor with the Workspace Admin role submits a valid user-creation request
- **THEN** the system creates the user and returns the created user resource

#### Scenario: Non-privileged workspace role is forbidden

- **WHEN** an authenticated actor whose workspace role is neither Workspace Owner nor Workspace Admin submits a user-creation request
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no user is created

#### Scenario: Unauthenticated request is rejected

- **WHEN** a user-creation request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no user is created

### Requirement: Mandatory user-creation input

The system SHALL require `name`, `email`, and `workspace_role_id` for user creation. The `email` MUST be a syntactically valid email address. The system SHALL NOT accept a password or any credential field from the client at creation time.

#### Scenario: Missing required field is rejected

- **WHEN** a user-creation request omits `name`, `email`, or `workspace_role_id`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no user is created

#### Scenario: Malformed email is rejected

- **WHEN** a user-creation request provides an `email` that is not a valid email address
- **THEN** the system rejects the request with a validation error
- **AND** no user is created

#### Scenario: Client-supplied password is ignored

- **WHEN** a user-creation request includes a password or other credential field
- **THEN** the system does not use any client-provided credential when creating the user

### Requirement: Assigned workspace role must be valid and non-owner

The system SHALL verify that `workspace_role_id` references an existing workspace role. The system SHALL reject any attempt to assign the Workspace Owner role to the new user.

#### Scenario: Unknown workspace role is rejected

- **WHEN** a user-creation request provides a `workspace_role_id` that does not reference an existing workspace role
- **THEN** the system rejects the request with a business-rule violation
- **AND** no user is created

#### Scenario: Assigning the Workspace Owner role is rejected

- **WHEN** an authorized actor submits a user-creation request whose `workspace_role_id` references the Workspace Owner role
- **THEN** the system rejects the request with a business-rule violation
- **AND** no user is created

#### Scenario: Assigning a permitted non-owner role succeeds

- **WHEN** an authorized actor submits a user-creation request whose `workspace_role_id` references a valid non-owner workspace role (such as Admin or Developer)
- **THEN** the system creates the user with that role

### Requirement: Unique user email

The system SHALL ensure email addresses are unique across workspace users. Two users MUST NOT share the same email. Duplicate names are permitted.

#### Scenario: Duplicate email is rejected

- **WHEN** an authorized actor submits a user-creation request with an `email` that already belongs to an existing user
- **THEN** the system rejects the request with a conflict error
- **AND** no new user is created

#### Scenario: Duplicate name is allowed

- **WHEN** an authorized actor submits a valid user-creation request with a `name` that matches an existing user but a unique `email`
- **THEN** the system creates the user

### Requirement: Account provisioned without a usable credential

The system SHALL create the new user without a usable password. A newly created user SHALL NOT be able to authenticate until the account has been activated through a separate activation flow.

#### Scenario: New account has no usable password

- **WHEN** the system creates a new user
- **THEN** the user is persisted without a usable password
- **AND** the created-user response contains no password or password hash

#### Scenario: Unactivated user cannot log in

- **WHEN** a newly created user who has not activated attempts to authenticate with any credentials
- **THEN** authentication fails

### Requirement: Single-use activation token issuance

On successful creation the system SHALL generate a single-use activation token, persist only a hash of the token together with an expiry, and return the activation token (or a link containing it) exactly once in the creation response. The system SHALL NOT persist the token in a directly usable (plaintext) form.

#### Scenario: Activation token is issued and returned once

- **WHEN** an authorized actor creates a new user
- **THEN** the system generates an activation token and stores only its hash with an expiry
- **AND** the creation response includes the activation token or activation link exactly once

#### Scenario: Activation token is not recoverable after creation

- **WHEN** the created-user record is subsequently read through any user-retrieval behavior
- **THEN** the activation token value is not exposed
- **AND** only the non-sensitive user fields are returned

### Requirement: Created-user response shape

On success the system SHALL return the created user with `id`, `name`, `email`, `workspace_role_id`, and timestamps, wrapped in a data envelope, with a created status, alongside the one-time activation token or link.

#### Scenario: Successful creation returns the user resource and activation token

- **WHEN** an authorized actor submits a valid user-creation request
- **THEN** the system responds with a created status and a data envelope containing the new user's `id`, `name`, `email`, `workspace_role_id`, and creation/update timestamps
- **AND** the response includes the one-time activation token or link
- **AND** the response omits any password or password hash

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
