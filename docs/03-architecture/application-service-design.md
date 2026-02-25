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

### 3.1 WorkspaceService

**Purpose:**

Handles workspace business logic such as users and roles management.

**Methods:**

- createUser()

  **Purpose:**

  Creates new user in the workspace.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | name                  | string             | The name of the user                 |
  | email                 | string             | The email of the user                |
  | workspace_role_id     | UUID               | The id of the role of the user       |

  **Authorization Rules:**

  - User must have workspace role:
    - Workspace Owner or Workspace Admin

  **Business Rules:**
  - All parameters are mandatory
  - Workspace role must be a valid role from the database
  - Workspace role cannot be the Workspace Owner role

  **Transactions:**

  - `Insert` user record

  **Other:**
  - Passwords are automatically created in the service and not provided by the user

- updateUserRole()

  **Purpose:**

  Updates user's role.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | user_id               | UUID               | The id of the user                   |
  | workspace_role_id     | UUID               | The id of the role                   |

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

**Methods:**

- createProject()

  **Purpose:**

  Creates new project.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | name                  | string             | The name of the project              |
  | description           | string             | The description of the project       |
  | creator_id            | UUID               | The id of the project creator        |

  **Authorization Rules:**

  - User must have workspace role:
    - Workspace Owner or Admin

  **Business Rules:**
  - All parameters are mandatory
  
  **Transactions:**

  All of the following operations must succeed atomically:
  1. `Insert` project record
  2. `Insert` project_member record with Project Owner role

- addProjectMember()

  **Purpose:**

  Add new member to the project.

  **Input Parameters:**

  | Field                 | Type               | Description                          |
  | --------------------- | ------------------ | ------------------------------------ |
  | project_id            | UUID               | The id of the project                |
  | user_id               | UUID               | the id of the user                   |
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

  **Transactions:**

  - `Insert` project_member record

- updateProjectRole()

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

- updateProject()

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