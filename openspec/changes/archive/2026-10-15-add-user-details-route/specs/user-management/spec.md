## ADDED Requirements

### Requirement: Authorized workspace user retrieval by id

The system SHALL allow an authenticated actor whose workspace role is among the `getUserById` action's allowed roles — Workspace Owner, Workspace Admin, or Developer — to retrieve a single workspace user by id. The acting actor SHALL be derived from the authenticated actor context and never from client-provided identity fields, and the authorization decision SHALL be made through the declarative authorization capability against the `workspace` scope, so that any future change to allowed roles is driven by the matrix alone.

#### Scenario: Workspace Owner retrieves a user

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid user-retrieval request for an existing workspace user
- **THEN** the system returns the requested workspace user resource

#### Scenario: Workspace Admin retrieves a user

- **WHEN** an authenticated actor with the Workspace Admin role submits a valid user-retrieval request for an existing workspace user
- **THEN** the system returns the requested workspace user resource

#### Scenario: Developer retrieves a user

- **WHEN** an authenticated actor with the Developer workspace role submits a valid user-retrieval request for an existing workspace user
- **THEN** the system returns the requested workspace user resource

#### Scenario: Workspace role not permitted for the action is forbidden

- **WHEN** an authenticated actor whose workspace role is not among the `getUserById` action's allowed roles submits a user-retrieval request
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no user data is returned

#### Scenario: Unauthenticated request is rejected

- **WHEN** a user-retrieval request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no user data is returned

### Requirement: Path identifier must be a well-formed user id

The system SHALL require the user-retrieval request to carry a well-formed user identifier as a path parameter. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence, so a malformed id SHALL NOT reach the authorization check or the repository.

#### Scenario: Malformed identifier is rejected

- **WHEN** a user-retrieval request is submitted whose path identifier is not a well-formed user id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no user data is returned

### Requirement: Unknown target user yields not-found

The system SHALL identify the target user from the request path and SHALL verify that the target exists. When the path identifier is well-formed but does not reference any existing workspace user, the system SHALL reject the request with a not-found error.

#### Scenario: Unknown target user is rejected

- **WHEN** an authorized actor submits a user-retrieval request for a well-formed user identifier that does not reference an existing workspace user
- **THEN** the system rejects the request with a not-found error
- **AND** no user data is returned

### Requirement: Single-resource response envelope for user retrieval

On success the system SHALL return the retrieved user as a data envelope containing `id`, `name`, `email`, `workspaceRoleId`, `status`, and creation/update timestamps, with a success status.

#### Scenario: Successful retrieval returns the user resource

- **WHEN** an authorized actor submits a valid user-retrieval request for an existing workspace user
- **THEN** the system responds with a success status and a data envelope containing the target user's `id`, `name`, `email`, `workspaceRoleId`, `status`, and creation/update timestamps

### Requirement: Safe fields only in retrieved user

The user resource returned by the user-retrieval behavior SHALL contain only the non-sensitive user fields: `id`, `name`, `email`, `workspaceRoleId`, `status`, and creation/update timestamps. The response SHALL NOT expose any credential material, activation material, or password-related field — including but not limited to a password, a password hash, an activation token, an activation-token hash, or an activation-token expiry.

#### Scenario: Retrieved user exposes only safe fields

- **WHEN** an authorized actor submits a valid user-retrieval request for an existing workspace user
- **THEN** the response's `data` object contains exactly `id`, `name`, `email`, `workspaceRoleId`, `status`, and creation/update timestamps

#### Scenario: Credential and activation fields are never exposed

- **WHEN** an authorized actor submits a valid user-retrieval request for an existing workspace user
- **THEN** the response's `data` object contains no password, password hash, activation token, activation-token hash, or activation-token expiry
