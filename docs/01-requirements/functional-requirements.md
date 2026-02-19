# Functional Requirements

## Authentication

- Users authenticate using email and password.
- Admin or Owner creates user accounts.
- Users can log out of the system.

## Roles

- The system supports three global roles:
  - Owner
  - Admin
  - Developer
- Owner has full system permissions.
- Admin manages users and projects but cannot modify the Owner role.

## User Management

- Owner and Admin can create new users.
- Owner can change user roles.
- Admin cannot change Owner role.

## Project Management

- Owner and Admin can create projects.
- Owner and Admin can add or remove users from projects.
- Projects contain issues and subtasks.
- Only project members can access a project and its issues and subtasks.

## Issues

- Project members can:
  - Create, update and delete issues
  - Assign issues to users
  - Change issue status
- Issue statuses:
  - To-Do
  - In Progress
  - Done

## Subtasks

- Project members can:
  - Create, update and delete subtasks
  - Assing subtasks to users
  - Change subtask status
- Subtasks statuses:
  - To-Do
  - In Progress
  - Done