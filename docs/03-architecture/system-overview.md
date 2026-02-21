# High-Level Architecture

## 1. System Overview

### 1.1 Purpose

The system provides a web-based application for project and issue management.

### 1.2 Architectural Style

The system follows a modular monolith architectural pattern.

This approach provides reduced operational complexity while maintaining clear separation of concerns and modular domain boundaries.

### 1.3 Design Principles

The architecture of the system is guided by the following principles:

- **Simplicity First** <br />
The system is designed as a modular monolith to reduce operational complexity while maintaining clear separation of concerns.
- **Separation of Concerns** <br />
Presentation, business logic, authorization and persistence layer are clearly separated to improve readability and testing.
- **Explicit Authorization** <br />
All access control decisions are centralized to prevent unauthorized access to resources.
- **Modularity** <br />
Core domain components are isolated to allow extension without refactoring.
- **Maintainability over Premature Optimization** <br />
The system favors clean architecture and readability over premature performance optimization.

## 2. System Context

The system is a web-based application accessed by authenticated users (Owner, Admin, and Developer).

Users interact with the system through a web client.

The system consists of:

- A client application (front-end)
- A backend API server
- A relational database for persistent storage

There are no external third-party integrations. All business logic, authentication, authorization, presentation, and persistence are handled internally.

## 3. Major Components

### 3.1 Client Layer

It provides a user interface for interacting with the system.

It consists of:
- A web client

The technologies used for implementation:
- Typescript
- Next.js (latest)
- TailwindCSS

### 3.2 API Layer

It exposes endpoints for client-server interactions. All endpoints require authentication and are protected by middleware.

### 3.3 Application Layer (Business Logic)

It defines services which provide the core business logic of the system. They process requests and enforce authorization rules before executing domain operations.

### 3.4 Persistence Layer

This layer is an abstraction on top of the database which allows services to use a database-agnostic interface for database interactions. This allows separation of concerns, readability, extensibility and easy way for modifications.

### 3.5 Database

It is responsible for storing and persisting application data. A relational database is used.

## 4. Component Interaction and Data Flow

### User authentication flow

1. User submits credentials via the client.
2. The API receives the request and validates credentials.
3. If valid, a JWT token containing user identity and role is generated.
4. The token is returned to the client.
5. Subsequent requests include the token in the Authorization header.

### Project creation

1. User submits a project creation request via the client.
2. Authentication middleware validates the JWT token.
3. Authorization logic verifies that the user has permission to create a project.
4. The request is forwarded to the Application Layer service.
5. The service executes business logic and calls the Persistence Layer.
6. The Persistence Layer inserts the new project record into the database.
7. A success response is returned to the client.

### Issue creation

1. User submits an issue creation request via the client.
2. Authentication middleware validates the JWT token.
3. Authorization logic verifies that the user is a member of the target project.
4. The request is forwarded to the Application Layer service.
5. The service executes business logic and calls the Persistence Layer.
6. The Persistence Layer inserts the new issue record into the database.
7. A success response is returned to the client.

### Authorization enforcement flow

1. Owner or Admin submits a role update request via the client.
2. Authentication middleware validates the JWT token.
3. Authorization logic verifies that the requester has permission to modify roles.
4. The request is handled by the Application Layer service.
5. The service updates the user's role via the Persistence Layer.
6. The database record is updated.
7. A success response is returned to the client.

## 5. Cross-Cutting Concerns

### Authentication

It is implemented by an authentication middleware. A JWT token is used for authenticating requests.

### Authorization

Each token contains the user's role, which is evaluated against required scopes during request processing.

### Logging

A custom service will be implemented for a detailed server logging. It will track each request, log each user action and error handling.

### Error handling

A clear and consistent error structure, status codes and messages will be used to not expose security concerns but show clear guidelines how the application should handle it.

## 6. How Architecture Satisfies Non-functional Requirements

### Performance & Availability

- 200ms API response target:
  - layered architecture with efficient database access patterns and indexing
  - simple application logic
- 99% uptime:
  - simple deployment
  - automatic restart on crash

### Scalability

The modular monolith architecture is sufficient for the expected scale of up to 100 users and at least 1,000 issues without requiring distributed system complexity.

### Security

- Password hashing
  - Passwords are hashed before persistence using a secure hashing algorithm.
- Authenticated endpoints
  - authentication middleware protects endpoints from unauthenticated access
- Authorization
  - role + scopes evaluation prevents unauthorized access to resources

### Maintainability

The architecture consists of multiple layers with different responsibilities which work seamlessly and are easily extensible and readable.

### Observability

Structured logging is implemented to track requests, user actions, and system errors.