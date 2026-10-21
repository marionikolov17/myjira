## ADDED Requirements

### Requirement: Workspace bypass for project-scope actions

The authorization capability SHALL support, per project-scope action, an optional `workspaceBypass` set of workspace role names. When present, if the actor's workspace role is in the `workspaceBypass` set, the authorization decision SHALL permit the action regardless of whether the actor holds a project role on the target project. When absent, or when the actor's workspace role is not in the set, the decision SHALL fall through to the existing project-role check (actor must hold a project role on the target project AND that role must be among the action's allowed project roles). The `workspaceBypass` set SHALL be declarative data in the authorization matrix, consistent with the capability's single-source-of-truth property, and the decision SHALL remain I/O-free.

#### Scenario: Workspace bypass permits regardless of membership

- **WHEN** an authorization decision is requested for a `project`-scope action configured with a `workspaceBypass` set
- **AND** the actor's workspace role is in that set
- **AND** the actor holds no project role on the target project
- **THEN** the decision permits the action
- **AND** no project-role check is performed

#### Scenario: Workspace bypass permits a non-member actor

- **WHEN** an authorization decision is requested for a `project`-scope action configured with a `workspaceBypass` set
- **AND** the actor's workspace role is in that set
- **AND** the actor holds a project role on the target project that would otherwise not permit the action
- **THEN** the decision permits the action

#### Scenario: Workspace role not in bypass falls through to project-role check

- **WHEN** an authorization decision is requested for a `project`-scope action configured with a `workspaceBypass` set
- **AND** the actor's workspace role is not in that set
- **AND** the actor holds a project role on the target project that is among the action's allowed project roles
- **THEN** the decision permits the action

#### Scenario: No bypass configured preserves existing project-role behavior

- **WHEN** an authorization decision is requested for a `project`-scope action configured without any `workspaceBypass` set
- **THEN** the decision is reached solely by the existing project-role check against the action's allowed project roles

#### Scenario: Bypass does not weaken denial for actions without a configured entry

- **WHEN** an authorization decision is requested for a `scope` + `action` pair that has no entry in the matrix
- **THEN** the decision denies the action regardless of the actor's workspace role

#### Scenario: Bypass does not apply to workspace-scope actions

- **WHEN** an authorization decision is requested for a `workspace`-scope action
- **THEN** the decision is reached solely by comparing the actor's workspace role to the action's allowed workspace roles
- **AND** no `workspaceBypass` concept is consulted
