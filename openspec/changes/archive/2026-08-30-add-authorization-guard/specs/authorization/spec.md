## Purpose

Defines centralized, application-layer authorization: how the system decides whether an authenticated actor may perform a given action within a given scope, so that every service enforces access control consistently from a single declarative source of truth.

## ADDED Requirements

### Requirement: Actor-based authorization decisions

The authorization capability SHALL reach every access decision using only the authenticated actor's context (the actor's workspace role and the actor's project roles). It SHALL NOT perform database access or any other I/O to reach a decision.

#### Scenario: Decision derived from actor context

- **WHEN** an authorization decision is requested for an actor, scope, and action
- **THEN** the outcome is determined solely from the actor's workspace role and project roles already present in the actor context
- **AND** no database query or external lookup is performed as part of the decision

### Requirement: Declarative allowed-role configuration

Allowed roles SHALL be defined declaratively as a mapping from a `scope` + `action` pair to the set of role names permitted to perform that action. This mapping SHALL be the single source of truth for authorization decisions.

#### Scenario: Action permitted for a configured role

- **WHEN** an action is configured to allow a set of roles
- **AND** the actor holds one of those roles in the relevant scope
- **THEN** the decision permits the action

#### Scenario: Action denied for a non-configured role

- **WHEN** an action is configured to allow a set of roles
- **AND** the actor's role in the relevant scope is not in that set
- **THEN** the decision denies the action

### Requirement: Deny unknown actions by default

WHEN an authorization decision is requested for a `scope` + `action` pair that has no entry in the declarative configuration, THEN the capability SHALL deny the request. It SHALL NOT permit unconfigured actions.

#### Scenario: Unconfigured action is denied

- **WHEN** a decision is requested for an action that has no configured allowed-role entry
- **THEN** the decision denies the action

### Requirement: Workspace-scope authorization

For the `workspace` scope, the decision SHALL compare the actor's workspace role against the allowed roles for the action. No resource identifier is required for this scope.

#### Scenario: Workspace action allowed for actor's workspace role

- **WHEN** a `workspace`-scope action is requested
- **AND** the actor's workspace role is among the action's allowed roles
- **THEN** the decision permits the action

#### Scenario: Workspace action denied for actor's workspace role

- **WHEN** a `workspace`-scope action is requested
- **AND** the actor's workspace role is not among the action's allowed roles
- **THEN** the decision denies the action

### Requirement: Project-scope authorization

For the `project` scope, the decision SHALL require a target project identifier. The actor SHALL be authorized only if the actor holds a project role for that project AND that role is among the action's allowed roles.

#### Scenario: Project member with an allowed role is permitted

- **WHEN** a `project`-scope action is requested with a target project identifier
- **AND** the actor holds a project role for that project
- **AND** that role is among the action's allowed roles
- **THEN** the decision permits the action

#### Scenario: Project member with a disallowed role is denied

- **WHEN** a `project`-scope action is requested with a target project identifier
- **AND** the actor holds a project role for that project
- **AND** that role is not among the action's allowed roles
- **THEN** the decision denies the action

#### Scenario: Non-member of the project is denied

- **WHEN** a `project`-scope action is requested with a target project identifier
- **AND** the actor holds no project role for that project
- **THEN** the decision denies the action

#### Scenario: Missing project identifier is rejected

- **WHEN** a `project`-scope action is requested without a target project identifier
- **THEN** the decision denies the action

### Requirement: Denial and success behavior

On denial, the capability SHALL raise a forbidden authorization error that does not disclose which roles would have been sufficient. On a permitted decision, the capability SHALL return without mutating any state, allowing the caller to proceed.

#### Scenario: Denied decision raises a forbidden error

- **WHEN** an authorization decision denies a request
- **THEN** a forbidden authorization error is raised
- **AND** the error does not reveal the set of roles that would have been permitted

#### Scenario: Permitted decision produces no side effects

- **WHEN** an authorization decision permits a request
- **THEN** the capability returns without altering any application or persistence state
