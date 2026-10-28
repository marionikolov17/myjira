# MyJira

A role-aware issue tracker frontend (workspace → projects → issues) built with Next.js App Router, TanStack Query, Zustand, nuqs, React Hook Form + Zod, shadcn/ui (Base UI) and Tailwind v4.

The app runs entirely offline against an in-memory mock backend with realistic seed data, simulated latency and error shapes that match the real API contract.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick one of the demo accounts on the login screen (all share the demo password shown there).

## Project layout

```
src/
  app/                 Routes ((auth)/login, (app)/dashboard, projects, users, profile)
  components/
    common/            Shared building blocks (DataTable, badges, dialogs, empty/error states)
    layout/            App shell, sidebar, topbar, auth guard
    ui/                shadcn/ui components
  config/env.ts        Runtime flags (mock vs real transport, API base URL)
  features/<domain>/   queries.ts, mutations.ts, schemas.ts and components per domain
  lib/
    api/schemas/       Zod contracts for every resource and error envelope
    api/transport/     Transport interface + mock and HTTP implementations
    api/mocks/         In-memory DB, fixtures, latency and error helpers
    api/client/        Thin typed wrappers that validate responses with Zod
    authz/             can(), useCan(), <PermissionGate>
    query/             Query client and key factory
  stores/              Zustand stores (auth token, persisted)
```

UI code never imports from `lib/api/mocks` or a concrete transport. Everything goes through `lib/api/client/*`, which calls the `Transport` interface.

## Swapping the mock transport for the real API

### 1. Flip the switch

The transport is chosen in one place, `src/lib/api/transport/index.ts`:

```ts
export const transport: Transport = USE_MOCKS
  ? createMockTransport({ getToken })
  : createHttpTransport({ baseUrl: API_BASE_URL, getToken });
```

You can switch with an environment variable, without touching code:

```bash
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1   # defaults to /api/v1
```

Or make it a one-line change by replacing the ternary with `createHttpTransport({ baseUrl: API_BASE_URL, getToken })`.

When the real transport is active, `demoCredentials` is `null`, so the login screen hides the demo account picker.

### 2. Implement `httpTransport.ts`

`src/lib/api/transport/httpTransport.ts` is a typed stub. Each method throws `not implemented` and names the route it maps to. Implement one shared `request()` helper and have every method call it:

- Send `Authorization: Bearer <token>` using `getToken()` (the token comes from `POST /auth/login` and is persisted in the auth store).
- Send and receive JSON. Single resources come back as `{ data }`, lists as `{ data, meta }` (paginated) or `{ data }` (collections), and `DELETE` returns `204` with no body.
- Serialize list queries with `serializeListQuery()` so `page`, `pageSize`, `sort` and `filter` match what the mock already uses. The URL query format is shared through `queryString.ts`.
- On a non-2xx response, parse the error body and throw `ApiError.fromBody(status, body)`. The UI relies on `ApiError` codes for a few behaviors:
  - `401` clears the session and redirects to `/login`.
  - `403` renders the no-access state.
  - `404` renders not-found.
  - `422` validation errors map onto form fields via `handleFormError`.

| Method                    | Route                                               |
| ------------------------- | --------------------------------------------------- |
| `login`                   | `POST /auth/login`                                  |
| `getCurrentUser`          | `GET /users/me`                                     |
| `createUser`              | `POST /users`                                       |
| `listUsers`               | `GET /users`                                        |
| `getUserById`             | `GET /users/:id`                                    |
| `updateUserRole`          | `PATCH /users/:id/role`                             |
| `createProject`           | `POST /projects`                                    |
| `listProjects`            | `GET /projects`                                     |
| `getProjectById`          | `GET /projects/:id`                                 |
| `updateProject`           | `PATCH /projects/:id`                               |
| `deleteProject`           | `DELETE /projects/:id`                              |
| `addProjectMember`        | `POST /projects/:projectId/members`                 |
| `listProjectMembers`      | `GET /projects/:projectId/members`                  |
| `updateProjectMemberRole` | `PATCH /projects/:projectId/members/:memberId/role` |
| `removeProjectMember`     | `DELETE /projects/:projectId/members/:memberId`     |
| `createIssue`             | `POST /projects/:projectId/issues`                  |
| `listIssues`              | `GET /projects/:projectId/issues`                   |
| `getIssueById`            | `GET /projects/:projectId/issues/:issueId`          |
| `updateIssue`             | `PATCH /projects/:projectId/issues/:issueId`        |
| `deleteIssue`             | `DELETE /projects/:projectId/issues/:issueId`       |

Every response is parsed with the Zod schemas in `src/lib/api/schemas`. If the backend drifts from the contract, you get a clear parse error at the client boundary instead of a broken UI.

### 3. Authorization

Client-side permission checks (`can()` in `src/lib/authz/can.ts`) only decide what to show, such as hiding or disabling buttons and showing reasons. The backend must still enforce every rule. The mock transport enforces the same matrix, so `403` handling is already exercised during development.
