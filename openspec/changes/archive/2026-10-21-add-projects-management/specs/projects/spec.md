## Purpose

Defines the header-level lifecycle of projects: who may create, list, retrieve, update, and delete a project; how newly created projects are bootstrapped with a Project Owner member; how list results are scoped to the actor; and the shape of each response — so every project endpoint behaves consistently and enforces the project boundary required by the functional requirements.

## ADDED Requirements

### Requirement: Authorized project creation

The system SHALL allow only an authenticated actor whose workspace role is among the `createProject` action's allowed roles — Workspace Owner or Workspace Admin — to create a new project. The acting user SHALL be derived from the authenticated actor context and never from client-provided identity fields, and the authorization decision SHALL be made through the declarative authorization capability against the `workspace` scope.

#### Scenario: Workspace Owner creates a project

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid project-creation request
- **THEN** the system creates the project and returns the created project resource

#### Scenario: Workspace Admin creates a project

- **WHEN** an authenticated actor with the Workspace Admin role submits a valid project-creation request
- **THEN** the system creates the project and returns the created project resource

#### Scenario: Workspace role not permitted for the action is forbidden

- **WHEN** an authenticated actor whose workspace role is not among the `createProject` action's allowed roles submits a project-creation request
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project is created

#### Scenario: Unauthenticated request is rejected

- **WHEN** a project-creation request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no project is created

### Requirement: Mandatory project-creation input

The system SHALL require `name` and `description` for project creation. Both fields MUST be non-empty strings. Duplicate project names SHALL be permitted. The system SHALL ignore any client-supplied identifier, creator, timestamp, or membership fields.

#### Scenario: Missing required field is rejected

- **WHEN** a project-creation request omits `name` or `description`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project is created

#### Scenario: Empty required field is rejected

- **WHEN** a project-creation request provides an empty `name` or empty `description`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project is created

#### Scenario: Duplicate name is allowed

- **WHEN** an authorized actor submits a valid project-creation request whose `name` matches an existing project
- **THEN** the system creates the project

#### Scenario: Client-supplied identity fields are ignored

- **WHEN** a project-creation request includes `id`, `creatorId`, `createdAt`, `updatedAt`, or member-related fields in the payload
- **THEN** the system does not use any of those client-provided fields when creating the project

### Requirement: Project Owner bootstrap on creation

On successful creation the system SHALL atomically add the acting user to the new project as a project member whose project role is Project Owner. The project row and the project-member row SHALL be committed together: if either write fails, neither SHALL persist.

#### Scenario: Creation succeeds and project owner member is persisted

- **WHEN** an authorized actor successfully creates a project
- **THEN** the project exists
- **AND** a project-member row exists linking the acting user to the new project with the Project Owner project role

#### Scenario: Member write failure prevents project persistence

- **WHEN** the system fails to persist the Project Owner project-member row during creation
- **THEN** no project row persists
- **AND** the system responds with an error

### Requirement: Created-project response shape

On success the system SHALL return the created project with `id`, `name`, `description`, `creatorId`, `createdAt`, and `updatedAt`, wrapped in a data envelope, with a created status.

#### Scenario: Successful creation returns the project resource

- **WHEN** an authorized actor submits a valid project-creation request
- **THEN** the system responds with a created status and a data envelope containing the new project's `id`, `name`, `description`, `creatorId`, `createdAt`, and `updatedAt`

### Requirement: Authorized project listing

The system SHALL allow an authenticated actor whose workspace role is among the `listProjects` action's allowed roles — Workspace Owner, Workspace Admin, or Developer — to list projects. The authorization decision SHALL be made through the declarative authorization capability against the `workspace` scope.

#### Scenario: Workspace Owner lists projects

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid projects-list request
- **THEN** the system returns the requested page of projects

#### Scenario: Workspace Admin lists projects

- **WHEN** an authenticated actor with the Workspace Admin role submits a valid projects-list request
- **THEN** the system returns the requested page of projects

#### Scenario: Developer lists projects

- **WHEN** an authenticated actor with the Developer workspace role submits a valid projects-list request
- **THEN** the system returns the requested page of projects, scoped per the scoping requirement below

#### Scenario: Workspace role not permitted for the action is forbidden

- **WHEN** an authenticated actor whose workspace role is not among the `listProjects` action's allowed roles submits a projects-list request
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project data is returned

#### Scenario: Unauthenticated request is rejected

- **WHEN** a projects-list request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no project data is returned

### Requirement: Project-list scoping by actor

The system SHALL scope the projects-list result to the acting actor based on the actor's workspace role. An actor whose workspace role is Workspace Owner or Workspace Admin SHALL receive projects regardless of their project membership. An actor whose workspace role is Developer SHALL receive only projects where the acting user is a project member. Scoping SHALL be applied after authorization and before pagination, so pagination metadata reflects the scoped result set, not the unscoped one.

#### Scenario: Workspace Owner sees all projects

- **WHEN** an authenticated actor with the Workspace Owner role lists projects
- **AND** some projects exist that the actor is not a member of
- **THEN** the response includes those non-member projects

#### Scenario: Workspace Admin sees all projects

- **WHEN** an authenticated actor with the Workspace Admin role lists projects
- **AND** some projects exist that the actor is not a member of
- **THEN** the response includes those non-member projects

#### Scenario: Developer sees only member projects

- **WHEN** an authenticated actor with the Developer workspace role lists projects
- **AND** projects exist that the actor is not a member of
- **THEN** the response contains only projects where the actor is a project member
- **AND** the pagination metadata reflects the scoped total

#### Scenario: Developer with no memberships sees an empty list

- **WHEN** an authenticated actor with the Developer workspace role lists projects
- **AND** the actor is not a member of any project
- **THEN** the response contains an empty `data` array and reports `totalItems` = 0 and `totalPages` = 0

### Requirement: Query-parameter contract for project listing

The projects-list request SHALL interpret its `page`, `pageSize`, `sort`, and `filter[...]` parameters through the shared query-parameter contract, governed by a projects configuration that declares:

- **Sortable fields**: `name`, `createdAt`, `updatedAt`.
- **Filterable fields and operators**:
  - `creatorId`: operators `eq`, `ne`, `in`.
  - `createdAt`, `updatedAt`: operators `eq`, `gt`, `gte`, `lt`, `lte`.
- **Pagination**: default `pageSize` = 10, maximum `pageSize` = 100.

The field `name` SHALL NOT be filterable. The field `description` SHALL be neither sortable nor filterable. Any sort field, filter field, operator, or value not permitted by this configuration SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter.

#### Scenario: Sort by an allowed field with descending prefix

- **WHEN** an authorized actor requests the projects list with `sort=-createdAt`
- **THEN** the returned page is ordered by `createdAt` descending

#### Scenario: Filter by creatorId with the default equality operator

- **WHEN** an authorized actor requests the projects list with `filter[creatorId]=<userId>`
- **THEN** the returned page contains only projects whose `creatorId` equals `<userId>`

#### Scenario: Filter with the `in` operator on creatorId

- **WHEN** an authorized actor requests the projects list with `filter[creatorId][in]=<userIdA>,<userIdB>`
- **THEN** the returned page contains only projects whose `creatorId` is either `<userIdA>` or `<userIdB>`

#### Scenario: Filter with a range operator on a timestamp field

- **WHEN** an authorized actor requests the projects list with `filter[createdAt][gte]=2026-01-01T00:00:00Z`
- **THEN** the returned page contains only projects whose `createdAt` is on or after that instant

#### Scenario: Filtering by name is rejected

- **WHEN** an authorized actor requests the projects list with any filter on the `name` field
- **THEN** the request is rejected with a validation error identifying the offending filter parameter
- **AND** no project data is returned

#### Scenario: Sort or filter on description is rejected

- **WHEN** an authorized actor requests the projects list sorting on or filtering on `description`
- **THEN** the request is rejected with a validation error identifying the offending parameter
- **AND** no project data is returned

#### Scenario: Page size above the projects maximum is rejected

- **WHEN** an authorized actor requests the projects list with `pageSize` greater than 100
- **THEN** the request is rejected with a validation error identifying the offending `pageSize` parameter

#### Scenario: Pagination defaults applied when omitted

- **WHEN** an authorized actor requests the projects list without `page` or `pageSize`
- **THEN** the response is computed for `page` = 1 and `pageSize` = 10

### Requirement: Collection response envelope for project list

On success the system SHALL return the projects-list response as a collection envelope containing a `data` array of project resources and a `meta.pagination` object with `page`, `pageSize`, `totalItems`, and `totalPages`, where `totalPages` is the total item count divided by the page size, rounded up, and is 0 when there are no matching projects.

#### Scenario: Successful list returns data array and pagination metadata

- **WHEN** an authorized actor submits a valid projects-list request
- **THEN** the system responds with a success status and a body containing a `data` array of project resources and a `meta.pagination` object reporting `page`, `pageSize`, `totalItems`, and `totalPages`

#### Scenario: Partial final page reflected in pagination metadata

- **WHEN** an authorized actor lists projects with `pageSize` = 10 against a matching set of 25 projects
- **THEN** the response reports `totalItems` = 25 and `totalPages` = 3

### Requirement: Project resource fields in list items

Each project resource returned in the projects-list `data` array SHALL contain exactly `id`, `name`, `description`, `creatorId`, `createdAt`, and `updatedAt`. The response SHALL NOT include members, issues, or any expanded relation at this endpoint.

#### Scenario: Listed projects expose only the project resource fields

- **WHEN** an authorized actor submits a valid projects-list request
- **THEN** every project in the `data` array contains exactly `id`, `name`, `description`, `creatorId`, `createdAt`, and `updatedAt`

### Requirement: Authorized project retrieval by id

The system SHALL allow an authenticated actor to retrieve a single project by id when the authorization decision for the `getProjectById` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor's workspace role is Workspace Owner or Workspace Admin regardless of project membership (workspace bypass), and otherwise when the actor holds a project role on the target project that is among the action's allowed project roles (Project Owner, Project Admin, or Developer).

#### Scenario: Workspace Owner retrieves any project

- **WHEN** an authenticated actor with the Workspace Owner role requests a project by id
- **AND** the actor is not a member of that project
- **THEN** the system returns the project resource

#### Scenario: Workspace Admin retrieves any project

- **WHEN** an authenticated actor with the Workspace Admin role requests a project by id
- **AND** the actor is not a member of that project
- **THEN** the system returns the project resource

#### Scenario: Project member retrieves their project

- **WHEN** an authenticated actor whose workspace role is Developer requests a project by id
- **AND** the actor holds a project role on that project among `PROJECT_OWNER`, `PROJECT_ADMIN`, or `DEVELOPER`
- **THEN** the system returns the project resource

#### Scenario: Non-member Developer is forbidden

- **WHEN** an authenticated actor whose workspace role is Developer requests a project by id
- **AND** the actor is not a member of that project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project data is returned

#### Scenario: Unauthenticated request is rejected

- **WHEN** a project-retrieval request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no project data is returned

### Requirement: Path identifier must be a well-formed project id for retrieval

The system SHALL require the project-retrieval request to carry a well-formed project identifier as a path parameter. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed identifier is rejected

- **WHEN** a project-retrieval request is submitted whose path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no project data is returned

### Requirement: Unknown target project yields not-found for retrieval

The system SHALL identify the target project from the request path and SHALL verify that the target exists. When the path identifier is well-formed, is permitted by authorization, but does not reference any existing project, the system SHALL reject the request with a not-found error.

#### Scenario: Unknown target project is rejected

- **WHEN** an authorized actor submits a project-retrieval request for a well-formed identifier that does not reference an existing project
- **THEN** the system rejects the request with a not-found error
- **AND** no project data is returned

### Requirement: Single-resource response envelope for project retrieval

On success the system SHALL return the retrieved project as a data envelope containing `id`, `name`, `description`, `creatorId`, `createdAt`, and `updatedAt`, with a success status. The response SHALL NOT include members, issues, or any expanded relation.

#### Scenario: Successful retrieval returns the project resource

- **WHEN** an authorized actor submits a valid project-retrieval request for an existing project
- **THEN** the system responds with a success status and a data envelope containing the target project's `id`, `name`, `description`, `creatorId`, `createdAt`, and `updatedAt`

### Requirement: Authorized project update

The system SHALL allow an authenticated actor to update a project when the authorization decision for the `updateProject` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor's workspace role is Workspace Owner regardless of project membership (workspace bypass), and otherwise when the actor holds the Project Owner project role on the target project. The authorization decision SHALL be made through the declarative authorization capability.

#### Scenario: Workspace Owner updates any project

- **WHEN** an authenticated actor with the Workspace Owner role submits a valid update request for a project
- **AND** the actor is not a member of that project
- **THEN** the system updates the project and returns the updated project resource

#### Scenario: Project Owner updates their project

- **WHEN** an authenticated actor whose project role on the target project is Project Owner submits a valid update request
- **THEN** the system updates the project and returns the updated project resource

#### Scenario: Workspace Admin is forbidden from updating

- **WHEN** an authenticated actor with the Workspace Admin role submits an update request for a project
- **AND** the actor does not hold the Project Owner project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project is modified

#### Scenario: Project Admin or Developer is forbidden from updating

- **WHEN** an authenticated actor whose project role on the target project is Project Admin or Developer submits an update request
- **AND** the actor is not a Workspace Owner
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project is modified

#### Scenario: Unauthenticated request is rejected

- **WHEN** an update request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no project is modified

### Requirement: Partial update payload for project

The system SHALL accept partial update payloads containing only `name`, `description`, or both. At least one of the two SHALL be present. When present, each field SHALL be a non-empty string; when absent, the corresponding stored field SHALL remain unchanged. The system SHALL reject any payload containing fields other than `name` or `description`, including `id`, `creatorId`, `createdAt`, `updatedAt`, or membership-related fields.

#### Scenario: Update name only

- **WHEN** an authorized actor submits an update request with only `name`
- **THEN** the system updates the project's `name`
- **AND** the project's `description` is unchanged

#### Scenario: Update description only

- **WHEN** an authorized actor submits an update request with only `description`
- **THEN** the system updates the project's `description`
- **AND** the project's `name` is unchanged

#### Scenario: Update both fields

- **WHEN** an authorized actor submits an update request with both `name` and `description`
- **THEN** the system updates both fields

#### Scenario: Empty payload is rejected

- **WHEN** an authorized actor submits an update request with neither `name` nor `description`
- **THEN** the system rejects the request with a validation error
- **AND** no project is modified

#### Scenario: Empty string value is rejected

- **WHEN** an authorized actor submits an update request where `name` or `description` is an empty string
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project is modified

#### Scenario: Disallowed field in payload is rejected

- **WHEN** an authorized actor submits an update request containing any field other than `name` or `description`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no project is modified

### Requirement: Path identifier must be a well-formed project id for update

The system SHALL require the project-update request to carry a well-formed project identifier as a path parameter. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed identifier is rejected

- **WHEN** a project-update request is submitted whose path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no project is modified

### Requirement: Unknown target project yields not-found for update

The system SHALL identify the target project from the request path and SHALL verify that the target exists. When the path identifier is well-formed, is permitted by authorization, but does not reference any existing project, the system SHALL reject the request with a not-found error.

#### Scenario: Unknown target project is rejected

- **WHEN** an authorized actor submits an update request for a well-formed identifier that does not reference an existing project
- **THEN** the system rejects the request with a not-found error
- **AND** no project is modified

### Requirement: Response shape for project update

On success the system SHALL return the updated project as a data envelope containing `id`, `name`, `description`, `creatorId`, `createdAt`, and `updatedAt`, with a success status.

#### Scenario: Successful update returns the updated project resource

- **WHEN** an authorized actor submits a valid update request for an existing project
- **THEN** the system responds with a success status and a data envelope containing the project's `id`, `name`, `description`, `creatorId`, `createdAt`, and `updatedAt` reflecting the applied change

### Requirement: Authorized project deletion

The system SHALL allow an authenticated actor to delete a project when the authorization decision for the `deleteProject` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor's workspace role is Workspace Owner regardless of project membership (workspace bypass), and otherwise when the actor holds the Project Owner project role on the target project.

#### Scenario: Workspace Owner deletes any project

- **WHEN** an authenticated actor with the Workspace Owner role submits a delete request for a project
- **AND** the actor is not a member of that project
- **THEN** the system deletes the project

#### Scenario: Project Owner deletes their project

- **WHEN** an authenticated actor whose project role on the target project is Project Owner submits a delete request
- **THEN** the system deletes the project

#### Scenario: Workspace Admin is forbidden from deleting

- **WHEN** an authenticated actor with the Workspace Admin role submits a delete request for a project
- **AND** the actor does not hold the Project Owner project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project is deleted

#### Scenario: Project Admin or Developer is forbidden from deleting

- **WHEN** an authenticated actor whose project role on the target project is Project Admin or Developer submits a delete request
- **AND** the actor is not a Workspace Owner
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no project is deleted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a delete request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no project is deleted

### Requirement: Path identifier must be a well-formed project id for deletion

The system SHALL require the project-deletion request to carry a well-formed project identifier as a path parameter. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed identifier is rejected

- **WHEN** a project-deletion request is submitted whose path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no project is deleted

### Requirement: Unknown target project yields not-found for deletion

The system SHALL identify the target project from the request path and SHALL verify that the target exists. When the path identifier is well-formed, is permitted by authorization, but does not reference any existing project, the system SHALL reject the request with a not-found error.

#### Scenario: Unknown target project is rejected

- **WHEN** an authorized actor submits a delete request for a well-formed identifier that does not reference an existing project
- **THEN** the system rejects the request with a not-found error

### Requirement: Hard delete with cascade

The system SHALL perform a hard delete that removes the project row and, by database-level cascade, all project-members referencing the project, all issues referencing the project, and all subtasks referencing those issues. The deletion SHALL be atomic: either all affected rows are removed or none are.

#### Scenario: Deleting a project removes its members

- **WHEN** an authorized actor successfully deletes a project
- **THEN** no project-member row referencing the deleted project exists

#### Scenario: Deleting a project removes its issues

- **WHEN** an authorized actor successfully deletes a project
- **AND** the project had issues
- **THEN** no issue row referencing the deleted project exists

#### Scenario: Deleting a project removes subtasks of its issues

- **WHEN** an authorized actor successfully deletes a project
- **AND** the project had issues with subtasks
- **THEN** no subtask row referencing a removed issue exists

### Requirement: Response shape for project deletion

On success the system SHALL respond with a no-content status and an empty body.

#### Scenario: Successful deletion returns no content

- **WHEN** an authorized actor submits a valid delete request for an existing project
- **THEN** the system responds with a no-content status and an empty body
