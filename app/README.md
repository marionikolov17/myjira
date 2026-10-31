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
  config/env.ts        Runtime config (API base URL, APP_NAME, WORKSPACE_NAME)
  features/<domain>/   Resource or composite modules (see below)
  lib/
    api/schemas/       Zod contracts for every resource and error envelope
    api/transport/     Transport interface + HTTP implementation (validates responses)
    api/client/        Thin typed wrappers around transport
    authz/             can(), useCan(), <PermissionGate>
    filters/           Shared nuqs list-filter / multi-select factories
    labels/            Display labels and icons (issues, roles) for shared UI
    query/             Query client, key factory, stale-time constants
  stores/              Zustand stores (auth token, persisted)
```

UI code never imports the transport directly. Everything goes through `lib/api/client/*`, which calls the `Transport` interface, which is implemented by `createHttpTransport` in `lib/api/transport/httpTransport.ts`.

### Feature module shapes

- **Resource modules** (`auth`, `projects`, `issues`, `members`, `users`, `roles`): own API hooks. Typical files are `queries.ts`, `mutations.ts`, optional `constants.ts` (sort options, page sizes), optional `options.ts`, and `components/*View.tsx`. Zod form/API contracts are imported from `@/lib/api/schemas` — features do not re-export them.
- **Composite modules** (`dashboard`, `profile`): UI-only; they compose other features’ queries/mutations and have no API client of their own.
- **Roles** is queries-only; hooks return standard TanStack Query results, with pure `roleById` / `workspaceRoleByName` / `projectRoleByName` helpers alongside.

### Query cache shapes

- List hooks return the full `Paginated<T>` envelope (`{ data, meta }`).
- Detail hooks and members unwrap `.data` in `queryFn` so consumers get the entity (or array) directly.
- Lookup hooks (`useWorkspaceRoles`, `useProjectRoles`) return the same `useQuery` result shape; resolve entries with the pure helpers above.

### Dialogs

Create/invite dialogs are **controlled** by the parent View (`open` / `onOpenChange`). The View owns the trigger button so the same dialog can be opened from headers and empty states.

### URL filters

Shared factories live in `lib/filters/`. Issues table filters (`status`, `priority`, …) are separate from board filters (`boardPriority`, `boardAssignee`) so Board ↔ Issues navigation does not clash.

## Environment

| Variable                   | Default                        | Description                      |
| -------------------------- | ------------------------------ | -------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5000/api/v1` | Base URL of the MyJira REST API. |

## Transport

`src/lib/api/transport/httpTransport.ts` owns every HTTP concern:

- Sends `Authorization: Bearer <token>` using the token persisted in the auth store.
- Serializes list queries with `serializeListQuery()` so `page`, `pageSize`, `sort` and `filter` match the server contract.
- Parses `{ data }` / `{ data, meta }` envelopes and **validates success bodies** with the Zod resource schemas.
- Rewrites `401 AUTHENTICATION_REQUIRED`, `401 INVALID_LOGIN_CREDENTIALS` and `403 FORBIDDEN` to friendly client-side copy; validation / business-rule / conflict messages are surfaced verbatim so field-specific feedback still reaches the user.
- On a non-2xx response throws an `ApiError` with the server-supplied code; the UI relies on it for several behaviors:
  - `401` clears the session and redirects to `/login`.
  - `403` renders the no-access state.
  - `404` renders not-found.
  - `400` (`VALIDATION_ERROR`) field details map onto form fields via `handleFormError`.

Display labels and icons live in `lib/labels/` so shared components never import feature modules. Feature `options.ts` files may re-export them for local convenience.

### Roles

Workspace-role and project-role UUIDs are server-generated. The client fetches both lists once per session via `useWorkspaceRoles()` / `useProjectRoles()` (see `src/features/roles/queries.ts`), caches them, and resolves names ↔ UUIDs with `roleById` / `workspaceRoleByName` / `projectRoleByName`. Assignable role lists for invite / add-member / role-change UIs come from `lib/authz/can.ts` (`invitableWorkspaceRoles`, `assignableWorkspaceRoles`, `assignableProjectRoles`).

## Authorization

Client-side permission checks (`can()` in `src/lib/authz/can.ts`) only decide what to show, such as hiding or disabling buttons and showing reasons. The backend enforces every rule for real.
