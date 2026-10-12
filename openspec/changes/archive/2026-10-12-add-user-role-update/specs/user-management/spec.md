## ADDED Requirements

### Requirement: Authorized workspace user role update

The system SHALL allow an authenticated actor whose workspace role is among the `updateUserRole` action's allowed roles — Workspace Owner — to update a workspace user's role. The acting actor SHALL be derived from the authenticated actor context and never from client-provided identity fields, and the authorization decision SHALL be made through the declarative authorization capability against the `workspace` scope, so that any future change to allowed roles is driven by the matrix alone.

#### Scenario: Workspace Owner updates a user's role

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid role-update request for an existing non-owner user
- **THEN** the system updates the user's workspace role and returns the updated user resource

#### Scenario: Workspace role not permitted for the action is forbidden

- **WHEN** an authenticated actor whose workspace role is not among the `updateUserRole` action's allowed roles submits a role-update request
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no user is modified

#### Scenario: Unauthenticated request is rejected

- **WHEN** a role-update request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no user is modified

### Requirement: Target of role update must be an existing non-owner user

The system SHALL identify the target user from the request path and SHALL verify that the target exists. The system SHALL reject any role-update request whose target user's current workspace role is Workspace Owner. The denial SHALL NOT reveal which transitions would otherwise have been permitted.

#### Scenario: Unknown target user is rejected

- **WHEN** an authorized actor submits a role-update request for a user identifier that does not reference an existing workspace user
- **THEN** the system rejects the request with a not-found error
- **AND** no user is modified

#### Scenario: Role update targeting a Workspace Owner is rejected

- **WHEN** an authorized actor submits a role-update request whose target user's current workspace role is Workspace Owner
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no user is modified

### Requirement: Valid requested role for role update

The system SHALL require `workspace_role_id` in the role-update payload. The system SHALL verify that `workspace_role_id` references an existing workspace role, and SHALL reject any attempt to assign the Workspace Owner role through this endpoint.

#### Scenario: Missing workspace_role_id is rejected

- **WHEN** a role-update request omits `workspace_role_id`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no user is modified

#### Scenario: Unknown workspace role is rejected

- **WHEN** a role-update request provides a `workspace_role_id` that does not reference an existing workspace role
- **THEN** the system rejects the request with a business-rule violation
- **AND** no user is modified

#### Scenario: Assigning the Workspace Owner role is rejected

- **WHEN** an authorized actor submits a role-update request whose `workspace_role_id` references the Workspace Owner role
- **THEN** the system rejects the request with a business-rule violation
- **AND** no user is modified

### Requirement: Legal role transition for role update

The system SHALL apply any role transition permitted by the preceding target and requested-role requirements. When the requested role equals the target user's current workspace role, the system SHALL treat the request as an idempotent no-op and return the unchanged user resource with a success status.

#### Scenario: Promote a Developer to Workspace Admin

- **WHEN** an authorized actor submits a role-update request for a user whose current workspace role is Developer, with `workspace_role_id` referencing the Workspace Admin role
- **THEN** the system updates the user's workspace role to Workspace Admin
- **AND** the response returns the updated user resource with the new workspace role

#### Scenario: Demote a Workspace Admin to Developer

- **WHEN** an authorized actor submits a role-update request for a user whose current workspace role is Workspace Admin, with `workspace_role_id` referencing the Developer role
- **THEN** the system updates the user's workspace role to Developer
- **AND** the response returns the updated user resource with the new workspace role

#### Scenario: Same-role request is an idempotent no-op

- **WHEN** an authorized actor submits a role-update request whose `workspace_role_id` references the target user's current workspace role
- **THEN** the system does not modify the user
- **AND** the response returns the unchanged user resource with a success status

### Requirement: Role update is independent of activation status

The system SHALL apply the role-update rules regardless of whether the target user's account has been activated. A user whose activation flow is still pending SHALL be eligible for role updates on the same terms as an activated user.

#### Scenario: Role update applies to a user who has not yet activated

- **WHEN** an authorized actor submits a valid role-update request for an existing non-owner user whose account has not been activated
- **THEN** the system updates the user's workspace role and returns the updated user resource

### Requirement: Role-update response shape

On success the system SHALL return the updated user as a data envelope containing `id`, `name`, `email`, `workspace_role_id`, `status`, and creation/update timestamps, with a success status. The response SHALL NOT expose any credential material, activation material, or password-related field — including but not limited to a password, a password hash, an activation token, an activation-token hash, or an activation-token expiry.

#### Scenario: Successful role update returns the user resource

- **WHEN** an authorized actor submits a valid role-update request
- **THEN** the system responds with a success status and a data envelope containing the target user's `id`, `name`, `email`, `workspace_role_id`, `status`, and creation/update timestamps

#### Scenario: Credential and activation fields are never exposed

- **WHEN** an authorized actor submits a role-update request that is either successfully applied or treated as an idempotent no-op
- **THEN** the response body contains no password, password hash, activation token, activation-token hash, or activation-token expiry
