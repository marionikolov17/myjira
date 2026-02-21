# Database Architecture

## 1. Overview

### 1.1 Purpose

The system will use relational database. This database model supports the complexity of the data model and the multiple relationships and constraints between entities. The data will be structured into tables. The tables will have fields, primary keys, foreign keys and composite keys which gives advantage over non-relational databases by providing more efficent querying and cascade operations.

### 1.2 Database Technology

The system will use Supabase as a database. It is a relational database built on top of PosgreSQL. It uses the latest technologies for data consistency and integrity and will be sufficent for the system's transactions. It provides best security practices, ACID compliance and backup strategy out of the box.

## 2. Data Modeling Approach

The tables and fields of the database will follow the conventions stated from the core domain model and its entities and their relationships. The tables will follow the entities names in plural. Each record will have a unique ID auto-generated from the database service as a natural primary key, foreign keys fields and audit fields (created_at, updated_at). The system will take advantage of the cascade operations to ensure data consistency and integrity when a parent entity is affected.

The system will have predefined user roles populated:

- Owner
- Admin
- Developer

The system will use the following enums for issues and subtasks statuses:

- To-Do (the issue/subtask is not started by anyone)
- In Progress (the issue/subtask is assigned to a user and the user is working on it)
- Done (the issue/subtask is done)

The system will use the following enums ofr issues priorities:

- Low 
- Medium
- High

## 3. Core Entities

The core domain entities and the interactions between them will be described in the following tables:

### 3.1 users

**Purpose:**

It represents the User entity.

**Attributes:**

| Field name        | Type     | Required | Description                          |
| -----------       | ----     | -------- | ------------------------------------ |
| id                | UUID     | true     | Unique identifier for each user      |
| name              | string   | true     | Name of the user                     |
| email             | string   | true     | Email of the user                    |
| password          | string   | true     | Hashed password of the user          |
| workspace_role_id | UUID     | true     | Assigned user role                   |
| created_at        | datetime | false    | Date of record creation              |
| updated_at        | datetime | false    | Date of record modification          |

**Primary key:**

- id (UUID) - This is the unique identifier of each user

**Relationships:**

- Many-to-one with `workspace_roles` on `workspace_roles.id` = `workspace_role_id`

**Constraints:**

- Unique name
- Valid email address format

### 3.2 workspace_roles

**Purpose:**

It stores workspace roles.

**Attributes:**

| Field name  | Type     | Required | Description                          |
| ----------- | ----     | -------- | ------------------------------------ |
| id          | UUID     | true     | Unique identifier for each role      |
| name        | enum     | true     | Role name                            |
| created_at  | datetime | false    | Date of record creation              |
| updated_at  | datetime | false    | Date of record modification          |

**Primary key:**

- id (UUID) - This is the unique identifier of each workspace role

**Constraints:**

- Name must be in ```['Owner', 'Admin', 'Member']``` enum

### 3.3 projects

**Purpose:**

It stores workspace projects.

**Attributes:**

| Field name  | Type     | Required | Description                          |
| ----------- | ----     | -------- | ------------------------------------ |
| id          | UUID     | true     | Unique identifier for each project   |
| name        | string   | true     | Name of the project                  |
| description | string   | false    | Description of the project           |
| creator_id  | UUID     | true     | Creator of the project               |
| created_at  | datetime | false    | Date of record creation              |
| updated_at  | datetime | false    | Date of record modification          |

**Primary key:**

- id (UUID) - This is the unique identifier of each project

**Relationships:**

- Many-to-one with `users` on `users.id` = `creator_id`

### 3.4 project_roles

**Purpose:**

It stores project roles.

**Attributes:**

| Field name  | Type     | Required | Description                          |
| ----------- | ----     | -------- | ------------------------------------ |
| id          | UUID     | true     | Unique identifier for each role      |
| name        | enum     | true     | Role name                            |
| created_at  | datetime | false    | Date of record creation              |
| updated_at  | datetime | false    | Date of record modification          |

**Primary key:**

- id (UUID) - This is the unique identifier of each project role

**Constraints:**

- Name must be in ```['Project Owner', 'Project Admin', 'Developer']``` enum

### 3.5 project_members

**Purpose:**

It stores project members.

**Attributes:**

| Field name      | Type     | Required | Description                          |
| -----------     | ----     | -------- | ------------------------------------ |
| id              | UUID     | true     | Unique identifier for each record    |
| project_id      | UUID     | true     | The id of the project                |
| user_id         | UUID     | true     | The id of the member user            |
| project_role_id | UUID     | true     | The user role in the project         |
| created_at      | datetime | false    | Date of record creation              |
| updated_at      | datetime | false    | Date of record modification          |

**Primary key:**

- id (UUID) - This is the unique identifier of each assigned user to the project

**Relationships:**

- Many-to-one with `projects` on `projects.id` = `project_id`
- Many-to-one with `users` on `users.id` = `user_id`
- Many-to-one with `project_roles` on `project_roles.id` = `project_role_id`

**Constraints:**

- Composite key on `project_id:user_id` (User cannot be assigned to one project multiple times)

### 3.6 issues

**Purpose:**

It stores issues per project.

**Attributes:**
| Field name  | Type     | Required | Description                          |
| ----------- | ----     | -------- | ------------------------------------ |
| id          | UUID     | true     | Unique identifier for each issue     |
| title       | string   | true     | Title of the issue item              |
| description | string   | false    | Description of the issue item        |
| status      | enum     | true     | The status of the issue              |
| priority    | enum     | true     | The priority of the issue            |
| creator_id  | UUID     | true     | The creator of the issue             |
| project_id  | UUID     | true     | The id of the parent project         |
| assignee_id | UUID     | false    | The id of the assigned user          |
| created_at  | datetime | false    | Date of record creation              |
| updated_at  | datetime | false    | Date of record modification          |

**Primary key:**

- id (UUID) - This is the unique identifier of each issue

**Relationships:**

- Many-to-one with `users` on `users.id` = `creator_id`
- Many-to-one with `projects` on `projects.id` = `project_id`
- Many-to-one with `users` on `users.id` = `assignee_id`

**Constraints:**

- Status must be in ```['To-Do', 'In Progress', 'Done']``` enum
- Priority must be in ```['Low', 'Medium', 'High']``` enum

### 3.7 subtasks

**Purpose:**

It stores subtasks per issue.

**Attributes:**
| Field name  | Type     | Required | Description                          |
| ----------- | ----     | -------- | ------------------------------------ |
| id          | UUID     | true     | Unique identifier for each subtask   |
| title       | string   | true     | Title of the subtask item            |
| description | string   | false    | Description of the subtask item      |
| status      | enum     | true     | The status of the subtask            |
| creator_id  | UUID     | true     | The creator of the subtask           |
| issue_id    | UUID     | true     | The id of the parent issue           |
| assignee_id | UUID     | false    | The id of the assigned user          |
| created_at  | datetime | false    | Date of record creation              |
| updated_at  | datetime | false    | Date of record modification          |

**Primary key:**

- id (UUID) - This is the unique identifier of each subtask

**Relationships:**

- Many-to-one with `users` on `users.id` = `creator_id`
- Many-to-one with `issues` on `issues.id` = `issue_id`
- Many-to-one with `users` on `users.id` = `assignee_id`

**Constraints:**

- Status must be in ```['To-Do', 'In Progress', 'Done']``` enum

## 4. Relationship Overview

The system data model follows a hierarchical relational structure with clearly defined ownership boundaries and referential integrity rules.

### 4.1 High-level Relationships Structure

The relationships between core entities are defined as follows:

- One workspace role -> Many users
- One user -> Many projects (creator)
- Many users -> Many projects (as project members via project_members)
- Many project members -> One project_role
- One project -> Many issues
- One issue -> Many subtasks
- One user -> Many issues (as assignee)
- One user -> Many subtasks (as assignee)

### 4.2 Referential Integrity & Cascade Behavior

The following cascade rules apply:
- Deleting a `project` will cascade delete:
  - related `project_members`
  - related `issues`
  - related `subtasks`
- Deleting an `issue` will cascade delete:
  - related `subtasks`
- Deleting a `user`:
  - must be restricted when:
    - user owns a project
    - user is a workspace owner
  - sets `assignee_id` to ```NULL``` where assigned
- Deletion of `workspace_role` or `project_role` is forbidden

These constraints ensure that the database maintains strong consistency and prevents orphaned records.

## 5. Transaction Boundaries

### 5.1 Project creation transaction

The following operations are performed and all must be successful:

- Create `projects` record
- Create `project_members` record with the project_id and user_id of the creator

## 6. Data Integrity & Constraints

### Global Constraints

- Only one user can have the "Owner" workspace role at a time.
- Users can only have one workspace role
- Users cannot be assigned to a project multiple times
- Issues must belong to a project
- Subtasks must belong to an issue

### Enum Constraints

- **status:**
  - To-Do 
  - In Progress
  - Done
- **priority:**
  - Low
  - Medium
  - High

## 7. Indexing & Performance Strategy

The following baseline indexing strategy will be applied:

- Index on all foreign key fields:
  - users.workspace_role_id
  - projects.creator_id
  - project_members.project_id
  - project_members.user_id
  - project_members.project_role_id
  - issues.project_id
  - issues.assignee_id
  - subtasks.issue_id
  - subtasks.assignee_id

- Composite unique index on (project_id, user_id) in project_members.

- Index on frequently filtered fields:
  - issues.status
  - issues.priority

These indexes ensure efficient filtering and joins while supporting the 200ms API response target defined in the non-functional requirements.

## 8. Scalability Considerations

A single instance of the database will handle the traffic for the planned usage without performance regression. A vertical scalling of the instance will be sufficent enough if performance stars downgrading for this usage. If usage spikes, horizontal scalling would be needed. For anticipated usage, vertical scaling and read replicas (if required) will be sufficient.
Horizontal sharding or partitioning would be considered only at significantly higher scale.

## 9. Future Enhancements

- Introduce soft-delete strategy to prevent destructive cascades and preserve auditability.

