# Non-Functional Requirements

## Performance

- 95% of API responses complete within 200ms under up to 10 concurrent users.
- Initial application load completes within 600ms on a standard broadband connection.

## Scalability

- The system supports up to 100 registered users.
- The system supports at least 1000 issues without performance degradation.

## Availability

- The system target uptime is 99% measured monthly.

## Security

- User passwords are securely hashed before storage.
- All protected endpoints require authentication.
- Authorization is enforced on all projects, issues and subtasks.
- Users can only access projects where they are members.

## Data Consistency and Integrity

- A subtask cannot be created without an existing parent issue.
- Deleting a project removes all related issues and subtasks automatically.

## Maintainability

- The system follows layered architecture with clear separation of concerns.
- All business logic is isolated from infrastructure concerns.
- Architecture and system design documentation are maintained and updated with major changes.
- Automated tests cover critical business logic.
  - Unit tests for core services
  - Integration tests for database interactions
  - System tests for API workflows and Front-End clients

## Observability

- Application errors are logged with timestamp and contextual metadata.
- Critical user actions (project creation, issue update, role changes) are logged.
- Logs are sufficient to diagnose production issues.