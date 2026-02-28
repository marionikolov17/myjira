# Application Service Design Template

## 1. Overview

### 1.1 Purpose

The Application Layer coordinates use cases, enforces authorization, manages transaction boundaries while delegating persistence operations to repositories.

## 2. Service Design Principles

Services implement the following design principles:

- One service per logical unit
- Stateless services
- Explicit authorization checks
- Transactions ownership
- Clear separation of concerns

## 3. Services

### 3.0 Service Execution Model

1. All services follow the same execution pattern:
2. Receive actor context (derived from authentication token)
3. Validate input
4. Invoke AuthorizationGuard using declarative configuration
5. Execute business rules
6. Execute transactional operations
7. Return result

Services do not trust client-provided identity fields. The authenticated user is derived exclusively from `actor`.

**Authorization:**

Authorization is validated through:

```ts
AuthorizationGuard.authorize({
  actor,
  scope: "scope",
  action: "action"
})
```

Allowed roles are defined declaratively in AuthorizationMatrix.

### 3.1 WorkspaceService

**Purpose:**

Handles workspace business logic such as users and roles management.

**Dependencies:**

- UserRepository
- RoleRepository
- AuthorizationGuard

**Methods:**

- ##createUser()

  **Purpose:**

  Creates new user in the workspace.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | name                  | string             | The name of the user                 |
  | email                 | string             | The email of the user                |
  | workspace_role_id     | UUID               | The id of the role of the user       |

  > The acting user is derived from actor.user_id.

  **Authorization Rules:**

  - User must have workspace role:
    - Workspace Owner or Workspace Admin

  **Business Rules:**
  - All parameters are mandatory
  - Workspace role must be a valid role from the database
  - Workspace role cannot be the Workspace Owner role
  - Email must be unique

  **Transactions:**

  - `Insert` user record

  **Other:**
  - Passwords are automatically created in the service and not provided by the user

- ##updateUserRole()

  **Purpose:**

  Updates user's role.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | user_id               | UUID               | The id of the user                   |
  | workspace_role_id     | UUID               | The id of the role                   |

  > The acting user is derived from actor.user_id.

  **Authorization Rules:**

  - User must have workspace role:
    - Workspace Owner or Admin

  **Business Rules:**
  - Cannot update workspace role to be Workspace Owner

  **Transactions:**

  - `Update` user record

### 3.2 ProjectService

**Purpose:**

Handles projects management.

**Dependencies:**

- ProjectRepository
- ProjectMemberRepository
- RoleRepository
- AuthorizationGuard

**Methods:**

- ##createProject()

  **Purpose:**

  Creates new project.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | name                  | string             | The name of the project              |
  | description           | string             | The description of the project       |

  > creator_id is derived from actor.user_id

  **Guard:**

  - Scope: workspace
  - Action: createProject

  **Authorization Rules:**

  - User must have workspace role:
    - Workspace Owner or Admin

  **Business Rules:**
  - All parameters are mandatory
  
  **Transactions:**

  All of the following operations must succeed atomically:
  1. `Insert` project record
  2. `Insert` project_member record with Project Owner role

- ##addProjectMember()

  **Purpose:**

  Add new member to the project.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | project_id            | UUID               | The id of the project                |
  | user_id               | UUID               | the id of the user                   |
  | project_role_id       | UUID               | The id of the project role           |

  **Guard:**

  - Authorization scope: project
  - Resource: project_id

  Actions:

  - Fetch actor’s project role
  - Validate against allowed roles

  **Authorization Rules:**

  - User must have one of the followings project roles:
    - Project Owner
    - Project Admin

  **Business Rules:**
  - All parameters are mandatory
  - The id of the project must be of a valid project
  - The id of the user must be of a valid user
  - The id of the project role must be an existing role in the database
  - The project role must not be a Project Owner

  **Transactions:**

  - `Insert` project_member record

- ##updateProjectRole()

  **Purpose:**

  Updates project member role.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | project_member_id     | UUID               | The id of the project                |
  | project_role_id       | UUID               | The id of the project role           |

  **Authorization Rules:**

  - User must have one of the followings project roles:
    - Project Owner
    - Project Admin

  **Business Rules:**
  - All parameters are mandatory
  - The id of the project must be of a valid project
  - The id of the user must be of a valid user
  - The id of the project role must be an existing role in the database
  - The project role must not be a Project Owner
  - Same user cannot change their role

  **Transactions:**

  - `Update` project_member record

- ##updateProject()

  **Purpose:**

  Updates project name or/and description.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | name                  | string             | The name of the project              |
  | description           | string             | The description of the project       |

  **Authorization Rules:**

  - User must be a Project Owner

  **Transactions:**

  - `Update` project record

### 3.3 IssueService

**Purpose:**

Handles project issues.

**Dependencies:**

- IssueRepository
- ProjectMemberRepository
- AuthorizationGuard

**Authorization:**

- Scope: project
- Resource: project_id
- Allowed roles defined declaratively

**Methods:**

- ##createIssue()

  **Purpose:**

  Creates project issue.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | title                 | string             | The title of the issue               |
  | description           | string             | The description of the issue         |
  | status                | enum (optional)    | The status of the issue (TO-DO)      |
  | priority              | enum               | The priority of the issue            |
  | project_id            | UUID               | The id of the issue project          |
  | assignee_id           | UUID (optional)    | The assignee of the issue            |

  > creator_id is derived from actor.user_id

  **Authorization Rules:**

  - User must be a Project Member

  **Transactions:**

  - `Insert` issue record

- ##asignIssue()

  **Purpose:**

  Assigns an issue to a user.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | issue_id              | UUID               | The id of the issue                  |
  | assignee_id           | UUID               | The id of the assigned user          |

  **Authorization Rules:**

  - User must be a Project Member

  **Transactions:**

  - `Update` issue record

- ##updateIssueStatus()

  **Purpose:**

  Updates issue status.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | issue_id              | UUID               | The id of the issue                  |
  | status                | enum               | The new status of the issue          |

  **Authorization Rules:**

  - User must be a Project Member

  **Transactions:**

  - `Update` issue record

### 3.4 SubtaskService

**Purpose:**

Handles issue subtasks.

**Dependencies:**

- SubtaskRepository
- IssueRepository
- ProjectMemberRepository
- AuthorizationGuard

**Authorization:**

- Scope: issue
- Resource: issue_id
- Allowed roles defined declaratively

**Methods:**

- ##createSubtask()

  **Purpose:**

  Creates issue subtask.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | title                 | string             | The title of the subtask             |
  | description           | string             | The description of the subtask       |
  | status                | enum (optional)    | The status of the subtask (TO-DO)    |
  | priority              | enum               | The priority of the subtask          |
  | project_id            | UUID               | The id of the subtask project        |
  | assignee_id           | UUID (optional)    | The assignee of the subtask          |

  > creator_id is derived from actor.user_id

  **Authorization Rules:**

  - User must be a Project Member

  **Transactions:**

  - `Insert` subtask record

- ##asignSubtask()

  **Purpose:**

  Assigns a subtask to a user.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | subtask_id            | UUID               | The id of the subtask                |
  | assignee_id           | UUID               | The id of the assigned user          |

  **Authorization Rules:**

  - User must be a Project Member

  **Transactions:**

  - `Update` subtask record

- ##updateSubtaskStatus()

  **Purpose:**

  Updates subtask status.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | subtask_id            | UUID               | The id of the subtask                |
  | status                | enum               | The new status of the subtask        |

  **Authorization Rules:**

  - User must be a Project Member

  **Transactions:**

  - `Update` subtask record

## Authorization Architecture

### Declarative Authorization Strategy

Authorization rules are defined in a centralized configuration mapping service methods to required roles and scope.

### Enforcement Layer

An AuthorizationGuard abstraction is responsible for:

- Resolving user roles
- Resolving resource context (e.g., project membership)
- Validating allowed roles
- Throwing authorization errors

Services invoke the guard explicitly at the beginning of each method.

Middleware is responsible only for authentication and actor context extraction.

## 5. Error Handling

Services extend default Error class by introducing custom errors which are propagated to an error handling middleware. Each custom error follows consistent class structure so a consistent response is provided. Error return types, custom errors and responses will be defined in an API design document.