# Reference Issue

This is a full example of a well-formed myjira issue. Use it to calibrate the
**structure and granularity** expected for a feature endpoint. Smaller fixes or
docs tasks may be shorter, but must still populate every template section.

GitHub title: `Feat: Authentication: Login Endpoint`
Label: `enhancement`

Body:

```markdown
## Login Endpoint

### Context

Create a new `POST /api/v1/auth/login` endpoint that authenticates a user by email and password and returns a signed JWT token on success.

**JWT**

A new token logic abstract interface should be created with implementation from the `jsonwebtoken` library, following the same fascade pattern as the logger and password hasher.

The JWT payload should include:

- `user_id` - user's id
- `workspace_role_id` - user's workspace role
- `iat` - issue at
- `exp` - expires in

**Environment Variables**

New environment variables must be created for JWT sign secret and token expiration.

- `JWT_SECRET` - sign secret
- `JWT_EXPIRES_IN` - token expiration (e.g. `1h`)

**Error Class**

A new error code must be added to `ErrorCodes` enum:

- `INVALID_LOGIN_CREDENTIALS`

A new error class  `InvalidLoginCredentialsError` must be created that extends the base `AppError` class:

| Property             | Value                                               |
|-------------------|---------------------------------------|
| HTTP status        | `401 Unauthorized`                         |
| Code                  | `INVALID_LOGIN_CREDENTIALS`     |
| Message            | `Invalid login credentials`                |
| Details               | `undefined`                                      |

**Architecture**

Create new `auth` module:

- `IAuthService` interface at `auth.interface.ts`
- `AuthService` class at `auth.service.ts`
- `AuthController` class at `auth.controller.ts`
- `LoginSchema` zod schema at `auth.schema.ts`
- `index.ts` - initialize service with all dependencies, initialize controller with service

Register the new `AuthController` router at `api/v1/auth` at `app.ts`.

Extend the user repository with required methods.

**Endpoint Flow**

1. Validate request body
2. Get user by email address
3. Verify passwords, throw `InvalidLoginCredentialsError` error if user is not found or passwords do not match
4. Build a JWT payload
5. Issue a new JWT token with the built payload, strong secret and configured expiration

**Request:**

\`\`\`
POST /api/v1/auth/login 
Content-Type: application/json

{ 
  "email": "user@example.com", 
  "password": "password123" 
}
\`\`\`

**Success Response**

\`\`\`
HTTP/1.1 200 OK

{
  "data": {
    "token": "<signed JWT>"
  }
}
\`\`\`

**Error Response**

- Invalid credentials:

\`\`\`
HTTP/1.1 401 Unauthorized

{
  "error": {
    "code": "INVALID_LOGIN_CREDENTIALS",
    "status": 401,
    "message": "Invalid login credentials"
  }
}
\`\`\`

- Validation error:

\`\`\`
HTTP/1.1 400 Bad Request

{
    "error": {
        "code": "VALIDATION_ERROR",
        "status": 400,
        "message": "Validation error",
        "details": {
            "fields": [
                {
                    "name": "email",
                    "message": "..."
                },
                {
                    "name": "password",
                    "message": "..."
                }
            ]
        }
    }
}
\`\`\`

### Acceptance Criteria

**Success**

- `POST /api/v1/auth/login` with correct credentials returns `200` and a response body containing `data.token` as a valid signed JWT for:
  - Owner user
  - Admin user
  - Developer user
- The decoded JWT payload contains the correct payload for the authenticated user

**Invalid Credentials**

- Request with a correct email but wrong password returns `401` with code `INVALID_LOGIN_CREDENTIALS` and message `Invalid login credentials`
- Request with a non-existent email returns `401` with code `INVALID_LOGIN_CREDENTIALS` and message `Invalid login credentials`

**Validation**

- Request with missing `email` returns `400` with code `VALIDATION_ERROR`
- Request with missing `password` returns `400` with code `VALIDATION_ERROR`
- Request with invalid email format returns `400` with code `VALIDATION_ERROR`
- Request with empty `email` returns `400` with code `VALIDATION_ERROR`
- Request with empty `password` returns `400` with code `VALIDATION_ERROR`
- Request with additional/unrecognized fields returns `400` with code `VALIDATION_ERROR` (strict schema)

### Tests

**Unit Tests**

Create unit tests for the new auth service with 100% branch coverage.

**Integration Tests**

Create integration tests for the new auth controller covering all acceptance criteria above.

### Definition of Done

- [ ] Specifications of the task are implemented
- [ ] All acceptance criterias are working functionally
- [ ] Unit tests are created for applicable files
- [ ] Integration tests are created for applicable files and to cover the acceptance criteria
- [ ] For a new route, an OpenAPI specification is documented after implementation and finish of the upper points
```
