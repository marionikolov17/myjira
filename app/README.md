# MyJira

A role-aware issue tracker frontend (workspace → projects → issues) built with Next.js App Router, TanStack Query, Zustand, nuqs, React Hook Form + Zod, shadcn/ui (Base UI) and Tailwind v4.

The app talks to the MyJira REST API over HTTP. The server contract lives in `../server/docs/openapi.json` and is served at `/docs` by the dev server.

## Getting started

```bash
# in ../server
npm install
npm run compose:up         # starts Postgres + Supabase for local dev
npm run db:migrate
npm run db:seed
npm run dev                # listens on PORT=5000

# in ./app
npm install
cp .env.local.example .env.local   # points NEXT_PUBLIC_API_BASE_URL at http://localhost:5000/api/v1
npm run dev
```

Open http://localhost:3000 and sign in with one of the bootstrapped accounts (see `server/.env.local` for `OWNER_EMAIL` / `ADMIN_EMAIL` / `DEVELOPER_EMAIL` and their passwords).

## Project layout

```
src/
  app/                 Routes ((auth)/login, (app)/dashboard, projects, users, profile)
  components/
    common/            Shared building blocks (DataTable, badges, dialogs, empty/error states)
    layout/            App shell, sidebar, topbar, auth guard
    ui/                shadcn/ui components
  config/env.ts        Runtime config (API base URL)
  features/<domain>/   queries.ts, mutations.ts, schemas.ts and components per domain
  lib/
    api/schemas/       Zod contracts for every resource and error envelope
    api/transport/     Transport interface + HTTP implementation
    api/client/        Thin typed wrappers around transport
    authz/             can(), useCan(), <PermissionGate>
    query/             Query client and key factory
  stores/              Zustand stores (auth token, persisted)
```

UI code never imports the transport directly. Everything goes through `lib/api/client/*`, which calls the `Transport` interface, which is implemented by `createHttpTransport` in `lib/api/transport/httpTransport.ts`.

## Environment

| Variable                   | Default                        | Description                      |
| -------------------------- | ------------------------------ | -------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5000/api/v1` | Base URL of the MyJira REST API. |

## Transport

`src/lib/api/transport/httpTransport.ts` owns every HTTP concern:

- Sends `Authorization: Bearer <token>` using the token persisted in the auth store.
- Serializes list queries with `serializeListQuery()` so `page`, `pageSize`, `sort` and `filter` match the server contract.
- Parses `{ data }` / `{ data, meta }` envelopes.
- Rewrites `401 AUTHENTICATION_REQUIRED`, `401 INVALID_LOGIN_CREDENTIALS` and `403 FORBIDDEN` to friendly client-side copy; validation / business-rule / conflict messages are surfaced verbatim so field-specific feedback still reaches the user.
- On a non-2xx response throws an `ApiError` with the server-supplied code; the UI relies on it for several behaviors:
  - `401` clears the session and redirects to `/login`.
  - `403` renders the no-access state.
  - `404` renders not-found.
  - `400` (`VALIDATION_ERROR`) field details map onto form fields via `handleFormError`.

### Roles

Workspace-role and project-role UUIDs are server-generated. The client fetches both lists once per session via `useWorkspaceRoles()` / `useProjectRoles()` (see `src/features/roles/queries.ts`), caches them, and uses `byName()` / `byId()` to resolve names ↔ UUIDs for the invite / add-member / role-change dialogs.

## Authorization

Client-side permission checks (`can()` in `src/lib/authz/can.ts`) only decide what to show, such as hiding or disabling buttons and showing reasons. The backend enforces every rule for real.
