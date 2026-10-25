## Purpose

Defines the project-scoped lifecycle of an issue: who may create, list, retrieve, update, or delete issues inside a project; which business rules govern the assignee, status, priority, and the default values applied at creation; and the shape of every response вЂ” so that issue data stays scoped to its owning project, cross-project identifier guessing cannot leak existence, and every endpoint behaves consistently with the authorization and pagination conventions established by the projects and project-members capabilities.

## ADDED Requirements

### Requirement: Authorized issue creation

The system SHALL allow an authenticated actor to create an issue in a project when the authorization decision for the `createIssue` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor holds a project role on the target project that is Project Owner, Project Admin, or Developer. There SHALL be no workspace bypass for issue creation. The authorization decision SHALL be made through the declarative authorization capability.

#### Scenario: Project Owner creates an issue

- **WHEN** an authenticated actor whose project role on the target project is Project Owner submits a valid create-issue request
- **THEN** the system creates the issue and returns the created issue resource

#### Scenario: Project Admin creates an issue

- **WHEN** an authenticated actor whose project role on the target project is Project Admin submits a valid create-issue request
- **THEN** the system creates the issue and returns the created issue resource
#### Scenario: Developer creates an issue

- **WHEN** an authenticated actor whose project role on the target project is Developer submits a valid create-issue request
- **THEN** the system creates the issue and returns the created issue resource

#### Scenario: Workspace Owner without a project role is forbidden

- **WHEN** an authenticated actor with the Workspace Owner role submits a create-issue request for a project
- **AND** the actor does not hold any project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no issue row is created

#### Scenario: Workspace Admin without a project role is forbidden

- **WHEN** an authenticated actor with the Workspace Admin role submits a create-issue request for a project
- **AND** the actor does not hold any project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no issue row is created

#### Scenario: Unauthenticated request is rejected
- **WHEN** a create-issue request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no issue row is created

### Requirement: Mandatory and strict create-issue input

The system SHALL require the create-issue request body to carry `title` and `description` as non-empty strings. The system SHALL accept `priority` and `assigneeId` as optional fields when provided. The system SHALL reject payloads that omit `title` or `description`, provide a malformed `assigneeId`, provide a `priority` that is not one of the configured enum values, or include any additional field вЂ” including the `status` field, which the system SHALL always set and never accept from the client. Rejections of these shape constraints SHALL be surfaced as validation errors identifying the offending field.

#### Scenario: Missing title is rejected

- **WHEN** a create-issue request omits `title`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Missing description is rejected

- **WHEN** a create-issue request omits `description`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Empty title is rejected

- **WHEN** a create-issue request provides a `title` that is the empty string
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Empty description is rejected

- **WHEN** a create-issue request provides a `description` that is the empty string
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Malformed assigneeId is rejected
- **WHEN** a create-issue request provides an `assigneeId` that is not a well-formed user identifier
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Unknown priority value is rejected

- **WHEN** a create-issue request provides a `priority` value that is not one of the configured enum values
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created
#### Scenario: status field in the payload is rejected

- **WHEN** a create-issue request includes a `status` field, regardless of its value
- **THEN** the system rejects the request with a validation error identifying `status` as an offending field
- **AND** no issue row is created

#### Scenario: Extra fields in the payload are rejected

- **WHEN** a create-issue request includes any field other than `title`, `description`, `priority`, and `assigneeId`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is created

#### Scenario: Non-object payload is rejected

- **WHEN** a create-issue request body is not a plain object
- **THEN** the system rejects the request with a validation error
- **AND** no issue row is created

### Requirement: Path identifier must be a well-formed project id for creation

The system SHALL require the create-issue request to carry a well-formed project identifier as a path parameter. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.
#### Scenario: Malformed project identifier is rejected

- **WHEN** a create-issue request is submitted whose path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue row is created

### Requirement: Unknown target project yields not-found for creation

The system SHALL verify that the target project exists before accepting a create-issue write. When the path identifier is well-formed, is permitted by authorization, but does not reference any existing project, the system SHALL reject the request with a not-found error.
#### Scenario: Unknown target project is rejected

- **WHEN** an authorized actor submits a create-issue request for a well-formed project identifier that does not reference an existing project
- **THEN** the system rejects the request with a not-found error
- **AND** no issue row is created

### Requirement: Server-set status and priority defaults on creation

The system SHALL set the newly created issue's `status` to the initial status value in all cases. The system SHALL set the newly created issue's `priority` to the configured default priority value when the request omits `priority`. When the request provides a valid `priority`, the system SHALL use the provided value. The initial status value and the default priority value SHALL be stable across requests.

#### Scenario: Omitted priority defaults to the configured default
- **WHEN** an authorized actor submits a create-issue request that omits `priority`
- **THEN** the system creates the issue with the configured default priority value

#### Scenario: Provided priority is used as given

- **WHEN** an authorized actor submits a create-issue request that provides a valid `priority`
- **THEN** the system creates the issue with the provided priority value

#### Scenario: Created issue always starts at the initial status

- **WHEN** an authorized actor submits a valid create-issue request
- **THEN** the created issue's `status` is the initial status value

### Requirement: Assignee defaults to the creator and must be a current project member when supplied

The system SHALL set the newly created issue's `assigneeId` to the acting actor's user identifier when the request omits `assigneeId`. When the request provides `assigneeId`, the system SHALL verify that the referenced user is a current project member of the target project before creating the issue. The system SHALL reject with a business-rule violation when the referenced user is not a current project member. The default-to-creator branch SHALL skip this verification because the creator's project membership is implied by the create-issue authorization decision.

#### Scenario: Omitted assignee defaults to the creator

- **WHEN** an authorized actor submits a create-issue request that omits `assigneeId`
- **THEN** the system creates the issue with its `assigneeId` set to the acting actor's user identifier

#### Scenario: Supplied assignee who is a project member is accepted

- **WHEN** an authorized actor submits a create-issue request whose `assigneeId` references a user who is a current member of the target project
- **THEN** the system creates the issue with its `assigneeId` set to the supplied value

#### Scenario: Supplied assignee who is not a project member is rejected

- **WHEN** an authorized actor submits a create-issue request whose `assigneeId` references a user who is not a current member of the target project
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no issue row is created
#### Scenario: Supplied assignee who references an unknown user is rejected

- **WHEN** an authorized actor submits a create-issue request whose `assigneeId` references a well-formed user identifier that does not reference an existing user
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no issue row is created

### Requirement: Response shape for issue creation

On success the system SHALL respond with a created status and a data envelope containing the created issue resource with its `id`, `title`, `description`, `status`, `priority`, `projectId`, an expanded `creator` object exposing `id`, `name`, and `email`, an expanded `assignee` object exposing `id`, `name`, and `email`, `createdAt`, and `updatedAt`. The response SHALL NOT include raw `creatorId` or `assigneeId` scalar fields.

#### Scenario: Successful creation returns the expanded issue resource

- **WHEN** an authorized actor submits a valid create-issue request
- **THEN** the system responds with a created status and a data envelope containing the new issue's `id`, `title`, `description`, `status`, `priority`, `projectId`, `creator: { id, name, email }`, `assignee: { id, name, email }`, `createdAt`, and `updatedAt`
- **AND** the response body contains no `creatorId` or `assigneeId` scalar fields

### Requirement: Authorized issue listing

The system SHALL allow an authenticated actor to list the issues of a project when the authorization decision for the `listIssues` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor's workspace role is Workspace Owner or Workspace Admin regardless of project membership (workspace bypass), and otherwise when the actor holds a project role on the target project that is Project Owner, Project Admin, or Developer.

#### Scenario: Workspace Owner lists issues of any project

- **WHEN** an authenticated actor with the Workspace Owner role requests the issue list for a project
- **AND** the actor is not a member of that project
- **THEN** the system returns the issue list

#### Scenario: Workspace Admin lists issues of any project

- **WHEN** an authenticated actor with the Workspace Admin role requests the issue list for a project
- **AND** the actor is not a member of that project
- **THEN** the system returns the issue list

#### Scenario: Project member lists issues of their project
- **WHEN** an authenticated actor whose project role on the target project is Project Owner, Project Admin, or Developer requests the issue list
- **THEN** the system returns the issue list

#### Scenario: Non-member Developer is forbidden

- **WHEN** an authenticated actor whose workspace role is Developer requests the issue list of a project
- **AND** the actor is not a member of that project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no issue data is returned
#### Scenario: Unauthenticated request is rejected

- **WHEN** an issue-list request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no issue data is returned

### Requirement: Path identifier must be a well-formed project id for listing

The system SHALL require the issue-list request to carry a well-formed project identifier as a path parameter. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed project identifier is rejected

- **WHEN** an issue-list request is submitted whose path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue data is returned

### Requirement: Unknown target project yields not-found for listing

The system SHALL verify that the target project exists before returning an issue list. When the path identifier is well-formed, is permitted by authorization, but does not reference any existing project, the system SHALL reject the request with a not-found error.

#### Scenario: Unknown target project is rejected

- **WHEN** an authorized actor submits an issue-list request for a well-formed project identifier that does not reference an existing project
- **THEN** the system rejects the request with a not-found error
- **AND** no issue data is returned

### Requirement: Issue list supports pagination, sorting, and the standard filter set

The system SHALL return the project's issues through the common pagination contract вЂ” accepting the `page`, `pageSize`, `sort`, and `filter[...]` query parameters as defined by the query-parameters capability вЂ” and SHALL apply a deterministic tiebreaker by `id` ascending so pagination is stable across pages. The system SHALL expose the following filterable and sortable surface:

- Sortable fields: `createdAt`, `updatedAt`, `title`, `priority`, `status`.
- Filterable fields and operators: `status` (`eq`, `ne`, `in`), `priority` (`eq`, `ne`, `in`), `assigneeId` (`eq`, `ne`, `in`), `creatorId` (`eq`, `ne`, `in`), `createdAt` (`eq`, `gt`, `gte`, `lt`, `lte`), `updatedAt` (`eq`, `gt`, `gte`, `lt`, `lte`).
The system SHALL reject any `sort` targeting a field outside the sortable set, any `filter[field]` targeting a field outside the filterable set, and any `filter[field][op]` using an operator not configured for that field вЂ” all as validation errors identifying the offending parameter.

#### Scenario: Pagination parameters narrow the response

- **WHEN** an authorized actor submits a valid issue-list request carrying `page` and `pageSize`
- **THEN** the response's `data` array contains at most `pageSize` entries and reflects the requested page
- **AND** the response's `meta.pagination` carries the requested `page`, the requested `pageSize`, the total item count, and the total page count

#### Scenario: Sorting by a configured field is applied

- **WHEN** an authorized actor submits a valid issue-list request carrying `sort` referencing a configured sortable field
- **THEN** the response's `data` array is ordered by that field in the requested direction
- **AND** entries with equal values for the sort field are ordered deterministically by `id` ascending

#### Scenario: Filtering by a configured field and operator restricts the response

- **WHEN** an authorized actor submits a valid issue-list request carrying a `filter[field][op]=value` for a configured field and operator
- **THEN** the response's `data` array contains only entries matching the filter
- **AND** the response's `meta.pagination.totalItems` reflects the filtered count

#### Scenario: Sorting by an unconfigured field is rejected
- **WHEN** an authorized actor submits an issue-list request whose `sort` targets a field outside the sortable set
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue data is returned

#### Scenario: Filtering by an unconfigured field is rejected

- **WHEN** an authorized actor submits an issue-list request carrying a `filter[field]` for a field outside the filterable set
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue data is returned
#### Scenario: Filtering by an unconfigured operator for a configured field is rejected

- **WHEN** an authorized actor submits an issue-list request carrying a `filter[field][op]` whose operator is not among the operators configured for that field
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue data is returned

### Requirement: Issue list is scoped to the target project

The system SHALL return only issues whose `projectId` equals the path project identifier. The system SHALL NEVER include an issue belonging to a different project in the response, regardless of filter parameters or workspace bypass. The project scoping SHALL be enforced at the repository layer by the query itself, not by post-filtering.

#### Scenario: List returns no issues from other projects
- **WHEN** an authorized actor submits a valid issue-list request for a project
- **AND** issues exist in other projects
- **THEN** the response's `data` array contains only issues whose `projectId` equals the path project identifier
- **AND** the response's `meta.pagination.totalItems` counts only issues of the path project

### Requirement: Collection response shape for issue listing

On success the system SHALL respond with a success status and a data envelope whose `data` array contains issue resources each exposing `id`, `title`, `description`, `status`, `priority`, `projectId`, an expanded `creator` object with `id`, `name`, and `email`, an expanded `assignee` object with `id`, `name`, and `email`, `createdAt`, and `updatedAt`. The response SHALL NOT include raw `creatorId` or `assigneeId` scalar fields on any list entry. The response SHALL carry a `meta.pagination` object with `page`, `pageSize`, `totalItems`, and `totalPages`.

#### Scenario: Successful list returns expanded issue resources with pagination meta

- **WHEN** an authorized actor submits a valid issue-list request against an existing project with issues
- **THEN** the system responds with a success status and a `data` array where every entry exposes `id`, `title`, `description`, `status`, `priority`, `projectId`, `creator: { id, name, email }`, `assignee: { id, name, email }`, `createdAt`, and `updatedAt`
- **AND** no list entry contains a raw `creatorId` or `assigneeId` field
- **AND** the response body contains a `meta.pagination` object with `page`, `pageSize`, `totalItems`, and `totalPages`

#### Scenario: Project with no issues returns an empty data array

- **WHEN** an authorized actor submits a valid issue-list request against an existing project with no issues
- **THEN** the response's `data` array is empty
- **AND** the response's `meta.pagination.totalItems` is zero

### Requirement: Authorized issue retrieval
The system SHALL allow an authenticated actor to retrieve a single issue when the authorization decision for the `getIssueById` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor's workspace role is Workspace Owner or Workspace Admin regardless of project membership (workspace bypass), and otherwise when the actor holds a project role on the target project that is Project Owner, Project Admin, or Developer.

#### Scenario: Workspace Owner retrieves an issue in any project

- **WHEN** an authenticated actor with the Workspace Owner role requests an issue in a project
- **AND** the actor is not a member of that project
- **THEN** the system returns the issue resource

#### Scenario: Workspace Admin retrieves an issue in any project

- **WHEN** an authenticated actor with the Workspace Admin role requests an issue in a project
- **AND** the actor is not a member of that project
- **THEN** the system returns the issue resource

#### Scenario: Project member retrieves an issue in their project

- **WHEN** an authenticated actor whose project role on the target project is Project Owner, Project Admin, or Developer requests an issue in their project
- **THEN** the system returns the issue resource

#### Scenario: Non-member Developer is forbidden

- **WHEN** an authenticated actor whose workspace role is Developer requests an issue in a project
- **AND** the actor is not a member of that project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no issue data is returned

#### Scenario: Unauthenticated request is rejected

- **WHEN** an issue-retrieval request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no issue data is returned
### Requirement: Path identifiers must be well-formed for retrieval

The system SHALL require the issue-retrieval request to carry both a well-formed project identifier and a well-formed issue identifier as path parameters. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed project identifier is rejected

- **WHEN** an issue-retrieval request is submitted whose project path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue data is returned

#### Scenario: Malformed issue identifier is rejected

- **WHEN** an issue-retrieval request is submitted whose issue path identifier is not a well-formed issue id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue data is returned

### Requirement: Unknown issue in the target project yields not-found for retrieval

The system SHALL return a not-found error when the issue identifier is well-formed, the actor is authorized, and either no issue with that identifier exists OR an issue with that identifier exists but belongs to a project other than the path project identifier. The system SHALL NEVER expose, through status code or response body differences, whether the issue identifier corresponds to an issue in another project. The scoping SHALL be enforced at the repository layer by querying for `(id, projectId)`.

#### Scenario: Unknown issue identifier is rejected
- **WHEN** an authorized actor submits an issue-retrieval request whose issue identifier does not reference any existing issue
- **THEN** the system rejects the request with a not-found error
- **AND** no issue data is returned

#### Scenario: Issue belonging to another project is rejected

- **WHEN** an authorized actor submits an issue-retrieval request whose issue identifier references an existing issue
- **AND** that issue's `projectId` is not the path project identifier
- **THEN** the system rejects the request with a not-found error
- **AND** no issue data is returned

### Requirement: Single-resource response shape for issue retrieval

On success the system SHALL respond with a success status and a data envelope containing the issue resource exposing `id`, `title`, `description`, `status`, `priority`, `projectId`, an expanded `creator` object with `id`, `name`, and `email`, an expanded `assignee` object with `id`, `name`, and `email`, `createdAt`, and `updatedAt`. The response SHALL NOT include raw `creatorId` or `assigneeId` scalar fields.

#### Scenario: Successful retrieval returns the expanded issue resource

- **WHEN** an authorized actor submits a valid issue-retrieval request against an existing issue in the path project
- **THEN** the system responds with a success status and a data envelope containing the issue's `id`, `title`, `description`, `status`, `priority`, `projectId`, `creator: { id, name, email }`, `assignee: { id, name, email }`, `createdAt`, and `updatedAt`
- **AND** the response body contains no `creatorId` or `assigneeId` scalar fields

### Requirement: Authorized issue update

The system SHALL allow an authenticated actor to update an issue when the authorization decision for the `updateIssue` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor holds a project role on the target project that is Project Owner, Project Admin, or Developer. There SHALL be no workspace bypass for issue update. The authorization decision SHALL be made through the declarative authorization capability. A single `updateIssue` decision SHALL govern any subset of updatable fields in the same request; the system SHALL NOT make per-field authorization decisions.

#### Scenario: Project Owner updates an issue in their project

- **WHEN** an authenticated actor whose project role on the target project is Project Owner submits a valid update-issue request
- **THEN** the system updates the issue and returns the updated issue resource

#### Scenario: Project Admin updates an issue in their project

- **WHEN** an authenticated actor whose project role on the target project is Project Admin submits a valid update-issue request
- **THEN** the system updates the issue and returns the updated issue resource

#### Scenario: Developer updates an issue in their project

- **WHEN** an authenticated actor whose project role on the target project is Developer submits a valid update-issue request
- **THEN** the system updates the issue and returns the updated issue resource

#### Scenario: Workspace Owner without a project role is forbidden

- **WHEN** an authenticated actor with the Workspace Owner role submits an update-issue request for a project
- **AND** the actor does not hold any project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no issue row is modified

#### Scenario: Workspace Admin without a project role is forbidden

- **WHEN** an authenticated actor with the Workspace Admin role submits an update-issue request for a project
- **AND** the actor does not hold any project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no issue row is modified

#### Scenario: Unauthenticated request is rejected

- **WHEN** an update-issue request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no issue row is modified

### Requirement: Mandatory and strict update-issue input

The system SHALL accept the update-issue request body as a plain object carrying any subset of `title`, `description`, `status`, `priority`, and `assigneeId`, with at least one of those fields present. The system SHALL reject payloads that provide an empty body, a `title` that is the empty string, a `description` that is the empty string, a `status` that is not one of the configured enum values, a `priority` that is not one of the configured enum values, a malformed `assigneeId`, or any field other than those five. Rejections of these shape constraints SHALL be surfaced as validation errors identifying the offending field.

#### Scenario: Empty body is rejected

- **WHEN** an update-issue request body is an object with no fields
- **THEN** the system rejects the request with a validation error
- **AND** no issue row is modified

#### Scenario: Empty title is rejected

- **WHEN** an update-issue request provides a `title` that is the empty string
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Empty description is rejected
- **WHEN** an update-issue request provides a `description` that is the empty string
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Unknown status value is rejected

- **WHEN** an update-issue request provides a `status` value that is not one of the configured enum values
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified
#### Scenario: Unknown priority value is rejected

- **WHEN** an update-issue request provides a `priority` value that is not one of the configured enum values
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Malformed assigneeId is rejected

- **WHEN** an update-issue request provides an `assigneeId` that is not a well-formed user identifier
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Extra fields in the payload are rejected

- **WHEN** an update-issue request includes any field other than `title`, `description`, `status`, `priority`, and `assigneeId`
- **THEN** the system rejects the request with a validation error identifying the offending field
- **AND** no issue row is modified

#### Scenario: Non-object payload is rejected
- **WHEN** an update-issue request body is not a plain object
- **THEN** the system rejects the request with a validation error
- **AND** no issue row is modified

### Requirement: Status transitions are free; priority has no transition rules

The system SHALL accept any valid `status` value for an update, regardless of the issue's current status. The system SHALL NOT enforce any status transition graph. The system SHALL likewise accept any valid `priority` value for an update, regardless of the current priority.

#### Scenario: Status may transition to any valid value

- **WHEN** an authorized actor submits a valid update-issue request whose `status` differs from the issue's current status
- **THEN** the system updates the issue's status to the requested value

#### Scenario: Priority may change to any valid value

- **WHEN** an authorized actor submits a valid update-issue request whose `priority` differs from the issue's current priority
- **THEN** the system updates the issue's priority to the requested value

### Requirement: Updated assignee must be a current project member

The system SHALL verify, when an update-issue request provides `assigneeId`, that the referenced user is a current project member of the issue's project before writing. The system SHALL reject with a business-rule violation when the referenced user is not a current project member. The system SHALL NOT run this check when `assigneeId` is absent from the update payload. The system SHALL NOT alter an existing stale assignee (an issue assigned to a user who has since been removed from the project) as a side effect of any other update.

#### Scenario: Supplied assignee who is a current project member is accepted
- **WHEN** an authorized actor submits an update-issue request whose `assigneeId` references a user who is a current member of the issue's project
- **THEN** the system updates the issue's assignee to the supplied value

#### Scenario: Supplied assignee who is not a current project member is rejected

- **WHEN** an authorized actor submits an update-issue request whose `assigneeId` references a user who is not a current member of the issue's project
- **THEN** the system rejects the request with a business-rule violation error
- **AND** no issue row is modified

#### Scenario: Update that omits assignee leaves a stale assignee untouched
- **WHEN** an authorized actor submits a valid update-issue request that does not include `assigneeId`
- **AND** the issue is currently assigned to a user who is no longer a member of the project
- **THEN** the system applies the requested updates and leaves the issue's assignee pointing to the same user

### Requirement: Path identifiers must be well-formed for update

The system SHALL require the update-issue request to carry both a well-formed project identifier and a well-formed issue identifier as path parameters. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed project identifier is rejected

- **WHEN** an update-issue request is submitted whose project path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue row is modified

#### Scenario: Malformed issue identifier is rejected

- **WHEN** an update-issue request is submitted whose issue path identifier is not a well-formed issue id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue row is modified

### Requirement: Unknown issue in the target project yields not-found for update
The system SHALL return a not-found error when the issue identifier is well-formed, the actor is authorized, and either no issue with that identifier exists OR an issue with that identifier exists but belongs to a project other than the path project identifier. The system SHALL NEVER expose, through status code or response body differences, whether the issue identifier corresponds to an issue in another project.

#### Scenario: Unknown issue identifier is rejected

- **WHEN** an authorized actor submits an update-issue request whose issue identifier does not reference any existing issue
- **THEN** the system rejects the request with a not-found error
- **AND** no issue row is modified

#### Scenario: Issue belonging to another project is rejected

- **WHEN** an authorized actor submits an update-issue request whose issue identifier references an existing issue
- **AND** that issue's `projectId` is not the path project identifier
- **THEN** the system rejects the request with a not-found error
- **AND** no issue row is modified

### Requirement: Response shape for issue update

On success the system SHALL respond with a success status and a data envelope containing the updated issue resource exposing `id`, `title`, `description`, `status`, `priority`, `projectId`, an expanded `creator` object with `id`, `name`, and `email`, an expanded `assignee` object with `id`, `name`, and `email`, `createdAt`, and `updatedAt`. The response SHALL NOT include raw `creatorId` or `assigneeId` scalar fields.

#### Scenario: Successful update returns the expanded issue resource

- **WHEN** an authorized actor submits a valid update-issue request against an existing issue in the path project
- **THEN** the system responds with a success status and a data envelope containing the issue's `id`, `title`, `description`, `status`, `priority`, `projectId`, `creator: { id, name, email }`, `assignee: { id, name, email }`, `createdAt`, and `updatedAt`
- **AND** the response body contains no `creatorId` or `assigneeId` scalar fields

### Requirement: Authorized issue deletion

The system SHALL allow an authenticated actor to delete an issue when the authorization decision for the `deleteIssue` action against the `project` scope permits the action. The decision SHALL permit the actor when the actor holds a project role on the target project that is Project Owner, Project Admin, or Developer. There SHALL be no workspace bypass for issue deletion. The authorization decision SHALL be made through the declarative authorization capability.

#### Scenario: Project Owner deletes an issue in their project

- **WHEN** an authenticated actor whose project role on the target project is Project Owner submits a valid delete-issue request
- **THEN** the system deletes the issue and returns a no-content success status

#### Scenario: Project Admin deletes an issue in their project

- **WHEN** an authenticated actor whose project role on the target project is Project Admin submits a valid delete-issue request
- **THEN** the system deletes the issue and returns a no-content success status

#### Scenario: Developer deletes an issue in their project

- **WHEN** an authenticated actor whose project role on the target project is Developer submits a valid delete-issue request
- **THEN** the system deletes the issue and returns a no-content success status
#### Scenario: Workspace Owner without a project role is forbidden

- **WHEN** an authenticated actor with the Workspace Owner role submits a delete-issue request for a project
- **AND** the actor does not hold any project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no issue row is deleted

#### Scenario: Workspace Admin without a project role is forbidden

- **WHEN** an authenticated actor with the Workspace Admin role submits a delete-issue request for a project
- **AND** the actor does not hold any project role on the target project
- **THEN** the system denies the request with a forbidden authorization error
- **AND** no issue row is deleted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a delete-issue request is submitted without a valid authentication token
- **THEN** the system rejects the request with an authentication-required error
- **AND** no issue row is deleted
### Requirement: Path identifiers must be well-formed for deletion

The system SHALL require the delete-issue request to carry both a well-formed project identifier and a well-formed issue identifier as path parameters. A malformed identifier SHALL be rejected uniformly through the unified error model as a validation error identifying the offending parameter. Validation SHALL run before authorization and before persistence.

#### Scenario: Malformed project identifier is rejected

- **WHEN** a delete-issue request is submitted whose project path identifier is not a well-formed project id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue row is deleted

#### Scenario: Malformed issue identifier is rejected

- **WHEN** a delete-issue request is submitted whose issue path identifier is not a well-formed issue id
- **THEN** the system rejects the request with a validation error identifying the offending parameter
- **AND** no issue row is deleted

### Requirement: Unknown issue in the target project yields not-found for deletion

The system SHALL return a not-found error when the issue identifier is well-formed, the actor is authorized, and either no issue with that identifier exists OR an issue with that identifier exists but belongs to a project other than the path project identifier. The system SHALL NEVER expose, through status code or response body differences, whether the issue identifier corresponds to an issue in another project.

#### Scenario: Unknown issue identifier is rejected
- **WHEN** an authorized actor submits a delete-issue request whose issue identifier does not reference any existing issue
- **THEN** the system rejects the request with a not-found error
- **AND** no issue row is deleted

#### Scenario: Issue belonging to another project is rejected

- **WHEN** an authorized actor submits a delete-issue request whose issue identifier references an existing issue
- **AND** that issue's `projectId` is not the path project identifier
- **THEN** the system rejects the request with a not-found error
- **AND** no issue row is deleted

### Requirement: Issue deletion cascades to subtasks

The system SHALL remove, as a side effect of deleting an issue, every subtask whose `issueId` references the deleted issue. The cascade SHALL be enforced at the database layer by the existing `onDelete: Cascade` relationship on `Subtask.issue`, not by application-layer iteration. The deletion of the issue and the removal of its subtasks SHALL occur atomically.

#### Scenario: Deleting an issue removes its subtasks

- **WHEN** an authorized actor submits a valid delete-issue request against an existing issue that has subtasks
- **THEN** the system deletes the issue and removes every subtask referencing that issue
- **AND** no orphaned subtask remains that references the deleted issue

### Requirement: Response for issue deletion

On success the system SHALL respond with a no-content success status and an empty body. The system SHALL NOT return a representation of the deleted issue.

#### Scenario: Successful deletion returns no-content

- **WHEN** an authorized actor submits a valid delete-issue request against an existing issue in the path project
- **THEN** the system responds with a no-content success status and an empty body
