## Purpose

Defines the project-scoped lifecycle of a project member: who may add a user to a project, list the project's members, change a member's project role, or remove a member; which role transitions and target-role combinations are legal; and the shape of every response — so the project team roster behaves consistently and the "every project has exactly one Project Owner" invariant holds structurally rather than by convention.

## ADDED Requirements

### Requirement: Authorized project-member addition

The system SHALL allow an authenticated actor to add a user to a project when the authorization decision for the `addProjectMember` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor's workspace role is Workspace Owner regardless of project membership (workspace bypass), and otherwise when the actor holds a project role on the target project that is Project Owner or Project Admin. The authorization decision SHALL be made through the declarative authorization capability.

#### Scenario: Workspace Owner adds a member to any project

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid add-member request for a project
- **AND** the actor is not a member of that project
- **THEN** the system adds the member and returns the created project-member resource

#### Scenario: Project Owner adds a member to their project

- **WHEN** an authenticated actor whose project role on the target project is Project Owner submits a valid add-member request
- **THEN** the system adds the member and returns the created project-member resource

#### Scenario: Project Admin adds a Developer to their project

- **WHEN** an authenticated actor whose project role on the target project is Project Admin submits a valid add-member request whose target project role is Developer
- **THEN** the system adds the member and returns the created project-member resource

#### Scenario: Workspace Admin without a project role is forbidden

- **WHEN** an authenticated actor with the Workspace Admin role submits an add-member request for a project
- **AND** the actor does not hold a Project Owner or Project Admin project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project-member row is created

#### Scenario: Developer is forbidden from adding members

- **WHEN** an authenticated actor whose project role on the target project is Developer submits an add-member request
- **AND** the actor is not a Workspace Owner
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project-member row is created

#### Scenario: Unauthenticated request is rejected

- **WHEN** an add-member request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no project-member row is created

### Requirement: Target project role must resolve to an assignable role

The system SHALL resolve the request's `projectRoleId` into a project role before performing any add-member or update-member-role write. The system SHALL reject the request with a business-rule violation when the `projectRoleId` does not resolve to any existing project role, and SHALL reject the request with a business-rule violation when it resolves to the Project Owner role. The Project Owner role SHALL NEVER be assignable through the add-member or update-member-role endpoints; it is only established by project bootstrap.

#### Scenario: Unknown projectRoleId on add is rejected

- **WHEN** an authorized actor submits an add-member request whose `projectRoleId` does not resolve to any project role
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is created

#### Scenario: projectRoleId resolving to Project Owner on add is rejected

- **WHEN** an authorized actor submits an add-member request whose `projectRoleId` resolves to the Project Owner role
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is created

#### Scenario: Unknown projectRoleId on update is rejected

- **WHEN** an authorized actor submits an update-member-role request whose `projectRoleId` does not resolve to any project role
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is modified

#### Scenario: projectRoleId resolving to Project Owner on update is rejected

- **WHEN** an authorized actor submits an update-member-role request whose `projectRoleId` resolves to the Project Owner role
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is modified

### Requirement: Project Admin may only add Developer-tier members

The system SHALL enforce a target-role ladder for the add-member action: an actor whose project role on the target project is Project Admin SHALL be permitted to add only members whose target project role (resolved from `projectRoleId`) is Developer. An attempt by a Project Admin to add a member whose resolved target role is Project Admin SHALL be rejected as a business-rule violation. This rule SHALL NOT apply when the actor's authorization is granted via workspace bypass (Workspace Owner), who SHALL be permitted to add Project Admin or Developer targets alike.

#### Scenario: Project Admin adding a Project Admin target is rejected

- **WHEN** an authenticated actor whose project role on the target project is Project Admin submits an add-member request whose `projectRoleId` resolves to the Project Admin role
- **AND** the actor is not a Workspace Owner
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is created

#### Scenario: Workspace Owner adding a Project Admin is permitted

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid add-member request whose `projectRoleId` resolves to the Project Admin role
- **THEN** the system adds the member and returns the created project-member resource

### Requirement: Mandatory and strict add-member input

The system SHALL require the add-member request to carry exactly two fields: `userId`, a well-formed user identifier, and `projectRoleId`, a well-formed project-role identifier. The system SHALL reject payloads that omit either field, provide a malformed value, or include any additional field. Rejections of these shape constraints SHALL be surfaced as validation errors identifying the offending field. Rejections based on what the `projectRoleId` resolves to are covered by the "Target project role must resolve to an assignable role" requirement.

#### Scenario: Missing userId is rejected

- **WHEN** an add-member request omits `userId`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project-member row is created

#### Scenario: Missing projectRoleId is rejected

- **WHEN** an add-member request omits `projectRoleId`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project-member row is created

#### Scenario: Malformed userId is rejected

- **WHEN** an add-member request provides a `userId` that is not a well-formed user identifier
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project-member row is created

#### Scenario: Malformed projectRoleId is rejected

- **WHEN** an add-member request provides a `projectRoleId` that is not a well-formed project-role identifier
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project-member row is created

#### Scenario: Extra fields in the payload are rejected

- **WHEN** an add-member request includes any field other than `userId` and `projectRoleId`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project-member row is created

#### Scenario: Non-object payload is rejected

- **WHEN** an add-member request body is not a plain object
- **THEN** the system rejects the request with a validation error
- **AND** no project-member row is created

### Requirement: Path identifier must be a well-formed project id for addition

The system SHALL require the add-member request to carry a well-formed project identifier as a path parameter. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed project identifier is rejected

- **WHEN** an add-member request is submitted whose path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no project-member row is created

### Requirement: Unknown target project yields not-found for addition

The system SHALL verify that the target project exists before authorizing the add-member action. When the path identifier is well-formed but does not reference any existing project, the system SHALL reject the request with a not-found error.

#### Scenario: Unknown target project is rejected

- **WHEN** an authorized actor submits an add-member request for a well-formed project identifier that does not reference an existing project
- **THEN** the system rejects the request with a not-found error
- **AND** no project-member row is created

### Requirement: Unknown target user yields a business-rule violation on addition

The system SHALL reject an add-member request whose `userId` does not reference an existing user with a business-rule violation error. The project row SHALL NOT be modified and no project-member row SHALL be created.

#### Scenario: Unknown userId is rejected

- **WHEN** an authorized actor submits an add-member request whose `userId` does not reference an existing user
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is created

### Requirement: Duplicate project-member is rejected

The system SHALL reject an add-member request whose `(projectId, userId)` pair already has a project-member row, as a conflict error. The existing membership SHALL remain unchanged.

#### Scenario: Adding an existing member is rejected

- **WHEN** an authorized actor submits an add-member request for a `(projectId, userId)` pair that already exists
- **THEN** the system rejects the request with a conflict error
- **AND** no additional project-member row is created
- **AND** the existing project-member row's project role is unchanged

### Requirement: Response shape for project-member addition

On success the system SHALL respond with a created status and a data envelope containing the created project-member resource with its `id`, `projectId`, an expanded `user` object exposing `id`, `name`, and `email`, and an expanded `projectRole` object exposing `id` and `name`. The response SHALL NOT include raw `userId` or `projectRoleId` scalar fields.

#### Scenario: Successful addition returns the expanded project-member resource

- **WHEN** an authorized actor submits a valid add-member request
- **THEN** the system responds with a created status and a data envelope containing the new project-member's `id`, `projectId`, `user: { id, name, email }`, and `projectRole: { id, name }`
- **AND** the response body contains no `userId` or `projectRoleId` scalar fields

### Requirement: Authorized project-member listing

The system SHALL allow an authenticated actor to list the project members of a project when the authorization decision for the `listProjectMembers` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor's workspace role is Workspace Owner or Workspace Admin regardless of project membership (workspace bypass), and otherwise when the actor holds a project role on the target project that is Project Owner, Project Admin, or Developer.

#### Scenario: Workspace Owner lists members of any project

- **WHEN** an authenticated actor with the Workspace Owner role requests the member list for a project
- **AND** the actor is not a member of that project
- **THEN** the system returns the full member list

#### Scenario: Workspace Admin lists members of any project

- **WHEN** an authenticated actor with the Workspace Admin role requests the member list for a project
- **AND** the actor is not a member of that project
- **THEN** the system returns the full member list

#### Scenario: Project member lists members of their project

- **WHEN** an authenticated actor whose project role on the target project is Project Owner, Project Admin, or Developer requests the member list
- **THEN** the system returns the full member list

#### Scenario: Non-member Developer is forbidden

- **WHEN** an authenticated actor whose workspace role is Developer requests the member list of a project
- **AND** the actor is not a member of that project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no member data is returned

#### Scenario: Unauthenticated request is rejected

- **WHEN** a member-list request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no member data is returned

### Requirement: Path identifier must be a well-formed project id for listing

The system SHALL require the member-list request to carry a well-formed project identifier as a path parameter. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed project identifier is rejected

- **WHEN** a member-list request is submitted whose path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no member data is returned

### Requirement: Unknown target project yields not-found for listing

The system SHALL verify that the target project exists before returning a member list. When the path identifier is well-formed, is permitted by authorization, but does not reference any existing project, the system SHALL reject the request with a not-found error.

#### Scenario: Unknown target project is rejected

- **WHEN** an authorized actor submits a member-list request for a well-formed project identifier that does not reference an existing project
- **THEN** the system rejects the request with a not-found error
- **AND** no member data is returned

### Requirement: Member list is always the full set with no query-parameter contract

The system SHALL return every project-member row of the target project in a single response, in a stable order by the member row identifier ascending, with no pagination, sorting, or filtering. The system SHALL reject any `page`, `pageSize`, `sort`, or `filter[...]` query parameter on this endpoint with a validation error identifying the offending parameter.

#### Scenario: Successful list returns every member

- **WHEN** an authorized actor submits a valid member-list request against a project with multiple members
- **THEN** the response's `data` array contains one entry for every project-member row of that project
- **AND** the response body contains no `meta.pagination` object

#### Scenario: Query parameters are rejected

- **WHEN** an authorized actor submits a member-list request carrying any of the query parameters `page`, `pageSize`, `sort`, or `filter[...]`
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no member data is returned


### Requirement: Collection response shape for project-member listing

On success the system SHALL respond with a success status and a data envelope whose `data` array contains project-member resources each exposing `id`, `projectId`, an expanded `user` object with `id`, `name`, and `email`, and an expanded `projectRole` object with `id` and `name`. The response SHALL NOT include raw `userId` or `projectRoleId` scalar fields on any list entry, SHALL NOT include a `meta.pagination` object, and SHALL return an empty `data` array when the project has only its bootstrapped Project Owner — never: a project must always have at least one member.

#### Scenario: Successful list returns expanded project-member resources

- **WHEN** an authorized actor submits a valid member-list request against an existing project
- **THEN** the system responds with a success status and a `data` array where every entry exposes `id`, `projectId`, `user: { id, name, email }`, and `projectRole: { id, name }`
- **AND** no list entry contains a raw `userId` or `projectRoleId` field
- **AND** the response body contains no `meta.pagination` object

#### Scenario: Project with only its bootstrapped Project Owner returns one entry

- **WHEN** an authorized actor submits a valid member-list request against a project whose only member is the Project Owner created at project bootstrap
- **THEN** the response's `data` array contains exactly one entry
- **AND** that entry's `projectRole.name` is `ProjectOwner`

### Requirement: Authorized project-member role update

The system SHALL allow an authenticated actor to change a project member's project role when the authorization decision for the `updateProjectMemberRole` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor's workspace role is Workspace Owner regardless of project membership (workspace bypass), and otherwise when the actor holds the Project Owner project role on the target project. The authorization decision SHALL be made through the declarative authorization capability.

#### Scenario: Workspace Owner updates a member's role in any project

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid update-member-role request for a project
- **AND** the actor is not a member of that project
- **THEN** the system updates the member's project role and returns the updated project-member resource

#### Scenario: Project Owner updates a member's role in their project

- **WHEN** an authenticated actor whose project role on the target project is Project Owner submits a valid update-member-role request
- **THEN** the system updates the member's project role and returns the updated project-member resource

#### Scenario: Project Admin is forbidden from updating a member's role

- **WHEN** an authenticated actor whose project role on the target project is Project Admin submits an update-member-role request
- **AND** the actor is not a Workspace Owner
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project-member row is modified

#### Scenario: Developer is forbidden from updating a member's role

- **WHEN** an authenticated actor whose project role on the target project is Developer submits an update-member-role request
- **AND** the actor is not a Workspace Owner
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project-member row is modified

#### Scenario: Workspace Admin is forbidden from updating a member's role

- **WHEN** an authenticated actor with the Workspace Admin role submits an update-member-role request for a project
- **AND** the actor does not hold the Project Owner project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project-member row is modified

#### Scenario: Unauthenticated request is rejected

- **WHEN** an update-member-role request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no project-member row is modified

### Requirement: Mandatory and strict update-member-role input

The system SHALL require the update-member-role request body to carry exactly one field, `projectRoleId`, a well-formed project-role identifier. The system SHALL reject payloads that omit `projectRoleId`, provide a malformed value, or include any additional field. Rejections of these shape constraints SHALL be surfaced as validation errors identifying the offending field. Rejections based on what the `projectRoleId` resolves to are covered by the "Target project role must resolve to an assignable role" requirement.

#### Scenario: Missing projectRoleId is rejected

- **WHEN** an update-member-role request omits `projectRoleId`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project-member row is modified

#### Scenario: Malformed projectRoleId is rejected

- **WHEN** an update-member-role request provides a `projectRoleId` that is not a well-formed project-role identifier
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project-member row is modified

#### Scenario: Extra fields in the payload are rejected

- **WHEN** an update-member-role request includes any field other than `projectRoleId`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project-member row is modified

#### Scenario: Non-object payload is rejected

- **WHEN** an update-member-role request body is not a plain object
- **THEN** the system rejects the request with a validation error
- **AND** no project-member row is modified

### Requirement: Path identifiers must be well-formed for update

The system SHALL require the update-member-role request to carry a well-formed project identifier and a well-formed member identifier as path parameters. A malformed identifier of either SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed project identifier is rejected

- **WHEN** an update-member-role request is submitted whose project path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no project-member row is modified

#### Scenario: Malformed member identifier is rejected

- **WHEN** an update-member-role request is submitted whose member path identifier is not a well-formed member id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no project-member row is modified

### Requirement: Unknown target yields not-found for update

The system SHALL identify the target project-member from the request path, SHALL verify that it exists, and SHALL verify that it belongs to the project identified by the path. When the member identifier is well-formed but does not reference any existing project-member row, or references a project-member row of a different project, the system SHALL reject the request with a not-found error.

#### Scenario: Unknown target member is rejected

- **WHEN** an authorized actor submits an update-member-role request for a well-formed member identifier that does not reference any existing project-member row
- **THEN** the system rejects the request with a not-found error
- **AND** no project-member row is modified

#### Scenario: Member belonging to a different project is rejected

- **WHEN** an authorized actor submits an update-member-role request for a well-formed member identifier whose project-member row belongs to a project other than the one in the path
- **THEN** the system rejects the request with a not-found error
- **AND** no project-member row is modified


### Requirement: Project Owner member role cannot be changed

The system SHALL reject any update-member-role request whose target project-member row has the Project Owner project role with a business-rule violation error, regardless of the actor's authorization. No PATCH operation SHALL ever change a member's role to Project Owner (see the add/update input requirements), and no PATCH operation SHALL ever change a member's role away from Project Owner.

#### Scenario: Updating the Project Owner member is rejected

- **WHEN** an authorized actor submits an update-member-role request whose target project-member row has the Project Owner project role
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is modified

### Requirement: Response shape for project-member role update

On success the system SHALL respond with a success status and a data envelope containing the updated project-member resource with its `id`, `projectId`, an expanded `user` object exposing `id`, `name`, and `email`, and an expanded `projectRole` object exposing `id` and `name` reflecting the newly applied role.

#### Scenario: Successful update returns the expanded project-member resource

- **WHEN** an authorized actor submits a valid update-member-role request against an existing project-member row
- **THEN** the system responds with a success status and a data envelope containing the member's `id`, `projectId`, `user: { id, name, email }`, and `projectRole: { id, name }` reflecting the applied role
- **AND** the response body contains no `userId` or `projectRoleId` scalar fields

### Requirement: Authorized project-member removal

The system SHALL allow an authenticated actor to remove a project member when the authorization decision for the `removeProjectMember` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor's workspace role is Workspace Owner regardless of project membership (workspace bypass), and otherwise when the actor holds a project role on the target project that is Project Owner or Project Admin. The authorization decision SHALL be made through the declarative authorization capability.

#### Scenario: Workspace Owner removes a member from any project

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid remove-member request for a project
- **AND** the actor is not a member of that project
- **THEN** the system removes the member

#### Scenario: Project Owner removes a member from their project

- **WHEN** an authenticated actor whose project role on the target project is Project Owner submits a valid remove-member request
- **THEN** the system removes the member

#### Scenario: Project Admin removes a Developer from their project

- **WHEN** an authenticated actor whose project role on the target project is Project Admin submits a valid remove-member request
- **AND** the target project-member's project role is Developer
- **THEN** the system removes the member

#### Scenario: Workspace Admin without a project role is forbidden

- **WHEN** an authenticated actor with the Workspace Admin role submits a remove-member request for a project
- **AND** the actor does not hold a Project Owner or Project Admin project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project-member row is removed

#### Scenario: Developer is forbidden from removing members

- **WHEN** an authenticated actor whose project role on the target project is Developer submits a remove-member request
- **AND** the actor is not a Workspace Owner
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project-member row is removed

#### Scenario: Unauthenticated request is rejected

- **WHEN** a remove-member request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no project-member row is removed

### Requirement: Project Admin may only remove Developer-tier members

The system SHALL enforce a target-role ladder for the remove-member action: an actor whose project role on the target project is Project Admin SHALL be permitted to remove only project-member rows whose project role is Developer. An attempt by a Project Admin to remove a project-member row whose project role is Project Admin SHALL be rejected as a business-rule violation. This rule SHALL NOT apply when the actor's authorization is granted via workspace bypass (Workspace Owner), who SHALL be permitted to remove Project Admin and Developer targets alike.

#### Scenario: Project Admin removing a Project Admin target is rejected

- **WHEN** an authenticated actor whose project role on the target project is Project Admin submits a remove-member request
- **AND** the target project-member's project role is Project Admin
- **AND** the actor is not a Workspace Owner
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is removed

### Requirement: Project Owner member cannot be removed

The system SHALL reject any remove-member request whose target project-member row has the Project Owner project role with a business-rule violation error, regardless of the actor's authorization. This rule guarantees that every project retains the Project Owner bootstrapped at project creation for the project's lifetime.

#### Scenario: Removing the Project Owner member is rejected

- **WHEN** an authorized actor submits a remove-member request whose target project-member row has the Project Owner project role
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is removed

### Requirement: Path identifiers must be well-formed for removal

The system SHALL require the remove-member request to carry a well-formed project identifier and a well-formed member identifier as path parameters. A malformed identifier of either SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed project identifier is rejected

- **WHEN** a remove-member request is submitted whose project path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no project-member row is removed

#### Scenario: Malformed member identifier is rejected

- **WHEN** a remove-member request is submitted whose member path identifier is not a well-formed member id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no project-member row is removed


### Requirement: Unknown target yields not-found for removal

The system SHALL identify the target project-member from the request path, SHALL verify that it exists, and SHALL verify that it belongs to the project identified by the path. When the member identifier is well-formed but does not reference any existing project-member row, or references a project-member row of a different project, the system SHALL reject the request with a not-found error.

#### Scenario: Unknown target member is rejected

- **WHEN** an authorized actor submits a remove-member request for a well-formed member identifier that does not reference any existing project-member row
- **THEN** the system rejects the request with a not-found error
- **AND** no project-member row is removed

#### Scenario: Member belonging to a different project is rejected

- **WHEN** an authorized actor submits a remove-member request for a well-formed member identifier whose project-member row belongs to a project other than the one in the path
- **THEN** the system rejects the request with a not-found error
- **AND** no project-member row is removed

### Requirement: Actor cannot mutate their own project membership

The system SHALL reject any update-member-role or remove-member request whose target project-member row's `userId` equals the acting actor's user id with a business-rule violation error. This rule applies regardless of the actor's workspace role or project role, including when the actor is authorized via workspace bypass. Self-mutation SHALL always be refused at the API surface.

#### Scenario: Actor cannot update their own project-member row

- **WHEN** an authorized actor submits an update-member-role request whose target project-member row has `userId` equal to the acting actor's user id
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is modified

#### Scenario: Actor cannot remove their own project-member row

- **WHEN** an authorized actor submits a remove-member request whose target project-member row has `userId` equal to the acting actor's user id
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no project-member row is removed

### Requirement: Response shape for project-member removal

On success the system SHALL respond with a no-content status and an empty body.

#### Scenario: Successful removal returns no content

- **WHEN** an authorized actor submits a valid remove-member request against an existing project-member row
- **THEN** the system responds with a no-content status and an empty body


### Requirement: Exactly one Project Owner per project for the project's lifetime

The system SHALL guarantee that every project has exactly one project-member row whose project role is Project Owner from project creation to project deletion. The guarantee SHALL be structural: the API surface SHALL make it impossible, via any combination of add, update-role, or remove operations, to produce a project with zero Project Owners or more than one Project Owner.

#### Scenario: Project creation produces exactly one Project Owner member

- **WHEN** a project is successfully created
- **THEN** the project has exactly one project-member row whose project role is Project Owner

#### Scenario: Add operation cannot create a second Project Owner

- **WHEN** any add-member request is submitted for a project that already has a Project Owner member
- **THEN** the system does not create a project-member row with project role Project Owner for that project
- **AND** the Project Owner invariant is preserved

#### Scenario: Update-role operation cannot remove the Project Owner

- **WHEN** any update-member-role request targets the Project Owner member
- **THEN** the system does not change that member's project role
- **AND** the Project Owner invariant is preserved

#### Scenario: Remove operation cannot remove the Project Owner

- **WHEN** any remove-member request targets the Project Owner member
- **THEN** the system does not remove that member
- **AND** the Project Owner invariant is preserved
