# API Design

## 1. API Overview

- RESTful JSON API
- Resource oriented
- Internal API
- API versioning via URL
- JWT Token Authentication
- Role-based Authorization
- OpenAPI specification

## 2. Authentication

The authentication token will be send to the API via:

- Bearer token in request Authorization Header.
- Token contains user_id and workspace role.
- Tokens are signed and validated on each request. Expired tokens result in 401 response.

Authorization is role-based and evaluated per request.
Workspace-level roles define global permissions.
Project-level roles define scoped permissions within a project.
Authorization is declaratively configured and validated in application layer before business logic execution.

## 3. Error Model

Error structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "status": 400, // Error status code from the response
    "message": "Error message here.",
    "details": { // Error specific details
      "fields": [ // For validation errors
        {
          "name": "field name",
          "message": "error message"
        }
      ]
    } 
  }
}
```

Error categories:

- `AUTHENTICATION_REQUIRED` -> 401
- `FORBIDDEN` -> 403
- `VALIDATION_ERROR` -> 400
- `RESOURCE_NOT_FOUND` -> 404
- `CONFLICT` -> 409
- `BUSINESS_RULE_VIOLATION` -> 422
- `INTERNAL_SERVER_ERROR` -> 500

## 4. Resources

> BASE_URL is /api/v1

## Workspace Level

### 4.1 Users

- `POST` /users

  **Responses:**

  - 201 Created -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 409 -> conflict
  - 422 -> business rules violation
  - 500 -> internal server failure

  **Idempotency:**

  - Enforce uniqueness (on email address)
  - Duplicate names are allowed
- `PATCH` /users/{id}

  **Responses:**

  - 200 -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 422 -> business rules violation
  - 500 -> internal server failure
- `GET` /users

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 500 -> internal server failure
- `GET` /users/{id}

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure

### 4.2 Projects

- `POST` /projects

  **Responses:**

  - 201 Created -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 422 -> business rules violation
  - 500 -> internal server failure

  **Idempotency:**

  - Duplicate names are allowed
- `PATCH` /projects/{id}

  **Responses:**

  - 200 -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 422 -> business rules violation
  - 500 -> internal server failure
- `DELETE` /projects/{id}

  **Responses:**

  - 204 No Content -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure
- `GET` /projects

  Supports pagination, filtering and sorting.

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 500 -> internal server failure

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 500 -> internal server failure

- `GET` /projects/{id}

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure

## Project Level

### 4.3 Project Members

- `POST` /projects/{projectId}/members

  **Responses:**

  - 201 Created -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 409 -> conflict
  - 422 -> business rules violation
  - 500 -> internal server failure

  **Idempotency:**

  - Duplicate members are not allowed
- `PATCH` /projects/{projectId}/members/{memberId}

  **Responses:**

  - 200 -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 422 -> business rules violation
  - 500 -> internal server failure
- `DELETE` /projects/{projectId}/members/{memberId}

  **Responses:**

  - 204 No Content -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure
- `GET` /projects/{projectId}/members

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure

### 4.4 Issues

- `POST` /projects/{projectId}/issues

  **Responses:**

  - 201 Created -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 422 -> business rules violation
  - 500 -> internal server failure
- `PATCH` /issues/{id}

  **Responses:**

  - 200 -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 422 -> business rules violation
  - 500 -> internal server failure
- `DELETE` /issues/{id}

  **Responses:**

  - 204 No Content -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure
- `GET` /projects/{projectId}/issues

  Supports pagination, filtering and sorting.

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure

- `GET` /issues/{id}

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure

## Issue Level

### 4.5 Subtasks

- `POST` /issues/{issueId}/subtasks

  **Responses:**

  - 201 Created -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 422 -> business rules violation
  - 500 -> internal server failure
- `PATCH` /subtasks/{id}

  **Responses:**

  - 200 -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 422 -> business rules violation
  - 500 -> internal server failure
- `DELETE` /subtasks/{id}

  **Responses:**

  - 204 No Content -> success
  - 400 -> validation error
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure
- `GET` /issues/{issueId}/subtasks

  Supports pagination, filtering and sorting.

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure
- `GET` /subtasks/{id}

  **Responses:**

  - 200 -> success
  - 401 -> authentication required
  - 403 -> forbidden
  - 404 -> resource not found
  - 500 -> internal server failure

## 5. Query Parameter Conventions

### 5.1 Pagination

- `page` (integer, default 1)
- `pageSize` (integer, default 10)

### 5.2 Sorting

- `sort` (string)
- Prefix with '-' for descending

Example:

```
sort=-createdAt
```

### 5.3 Filtering

- `filter[field]=value`
- `filter[field][operator]=value`

Supported operators are:

- `eq` (default) - Equal
- `ne` - Not Equal
- `gt` - Greater Than
- `gte` - Greater Than or Equal
- `lt` - Less Than
- `lte` - Less Than or Equal
- `in` - In

## 6. Response Schemas

The responses will follow the Envelope Pattern.

### 6.1 Success Response (Single Resource)

```json
{
  "data": {
    "id": "uuid",
    "field1": "value1",
    "field2": "..."
    // ...
  }
}
```

### 6.2 Success Response (Collection)

```json
{
  "data": [
    {
      "id": "uuid",
      "field1": "...",
      // ...
    },
    {
      "id": "uuid",
      "field1": "...",
      // ...
    },
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "totalItems": 120,
      "totalPages": 12
    },
    "requestId": "..."
  }
}
```

### 6.3 Success Response (No Content)

```
SUCCESS 204 
No Content
```

## 7. OpenAPI Specification

Link will be provided later.

## 8. Consistency Rules

1. All successful responses use data envelope.
2. All collection responses use meta.pagination.
3. All errors use unified error structure.
4. All resource identifiers are UUID.
5. All list endpoints support pagination, sorting and filtering.
6. HTTP status codes align with REST semantics.
7. Versioning is via /api/v1 prefix.
8. Every response includes `X-Request-Id` header for tracing.
9. PATCH requests are partial updates. Only provided fields are modified.
10. All timestamps are ISO 8601 UTC strings.

  - Example:

    ```
    2025-01-01T12:00:00Z
    ```