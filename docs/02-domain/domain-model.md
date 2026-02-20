# Domain Model

## User
- Attributes:
  - id
  - name
  - email
  - passwordHash
- Relationships:
  - has one Role
  - member of many Projects
  - assigned to many Issues
  - assigned to many Subtasks

## Role
- Attributes:
  - id
  - name
- Relationships:
  - assigned to many Users
  - has many Scopes

## Scope
- Attributes:
  - id
  - name
- Relationships:
  - belongs to one Role

## Project
- Attributes:
  - id
  - name
  - description
- Relationships:
  - has many Issues
  - has many Users (members)

## Issue
- Attributes:
  - id
  - title
  - description
  - status (To-Do, In Progress, Done)
- Relationships:
  - has many Subtasks
  - assigned to one User

## Subtask
- Attributes:
  - id
  - title
  - description
  - status (To-Do, In Progress, Done)
- Relationships:
  - belongs to an Issue
  - assigned to one User