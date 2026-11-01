# Project Instructions

Frontend for **myjira** (a Jira-like workspace/project tool). Read this before creating or
editing files under `app/`. This file is the agent-facing source of truth; `README.md` is
human setup only.

## Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript (strict).
- **Data**: TanStack Query, Zod-validated HTTP transport, Zustand (auth persist).
- **Forms / URL state**: React Hook Form + Zod resolvers, nuqs.
- **UI**: shadcn/ui (Base UI), Tailwind CSS v4, Lucide, Sonner, Framer Motion, `@dnd-kit` (board).
- **Path alias**: `@/*` → `src/*`. Prefer `@/` imports over long relative paths.

## Project Structure

```
app/
├── src/
│   ├── app/                 # Next.js routes, layouts, providers, global CSS
│   │   ├── (auth)/login     # Unauthenticated
│   │   └── (app)/           # Auth-guarded shell: dashboard, projects, users, profile
│   ├── components/
│   │   ├── common/          # Shared app UI (DataTable, badges, empty/error, filters)
│   │   ├── layout/          # Shell, sidebar, topbar, AuthGuard
│   │   └── ui/              # shadcn primitives — do not put domain logic here
│   ├── config/env.ts        # API_BASE_URL, APP_NAME, WORKSPACE_NAME
│   ├── features/<domain>/   # Resource or composite modules (see below)
│   ├── lib/
│   │   ├── api/schemas/     # Zod contracts + inferred types (mirror server)
│   │   ├── api/transport/   # Transport interface + HTTP impl (auth, envelopes, ApiError)
│   │   ├── api/client/      # Thin typed wrappers — UI/features call these only
│   │   ├── authz/           # can(), useCan(), PermissionGate (UI-only)
│   │   ├── filters/         # nuqs list / multi-select factories
│   │   ├── forms/           # handleFormError
│   │   ├── labels/          # Display labels/icons (shared UI must not import features)
│   │   ├── query/           # QueryClient, queryKeys, staleTime
│   │   ├── format.ts        # Dates, initials, short issue IDs
│   │   └── utils.ts         # cn()
│   └── stores/              # Zustand (auth token + actor)
└── public/
```

## Layers & How They Interact

Typical **read** path:

```
page.tsx → *View.tsx → filter hooks (nuqs) → feature queries
  → lib/api/client/* → Transport (httpTransport) → Zod schema → React Query cache
```

Typical **write** path:

```
*View / dialog → RHF + Zod → feature mutations → client → transport
  → invalidate / setQueryData via queryKeys; VALIDATION_ERROR → handleFormError
```

**Rules:**

- Route `page.tsx` files stay thin (metadata + render a feature `*View`). Prefer server
  pages that import a `'use client'` View.
- **UI / features never import transport.** Always go through `lib/api/client/*`.
- Zod API/form contracts live in `lib/api/schemas`. Features import them; they do not
  re-export or duplicate schemas.
- Shared components (`components/common`, `components/ui`) never import `features/*`.
  Put shared display maps in `lib/labels/`. Features and shared UI import labels from
  `@/lib/labels/*` directly — do **not** re-export labels from feature `options.ts`.

## Feature Module Shapes

### Resource modules (`auth`, `projects`, `issues`, `members`, `users`, `roles`)

Own API hooks. Typical files:

- `queries.ts` / `mutations.ts` — TanStack Query hooks
- `constants.ts` — sort options, page sizes (optional)
- `options.ts` — select / filter option arrays built for UI controls (optional); may
  _consume_ `@/lib/labels/*` internally, but must not re-export those label maps
- `hooks/` — URL filter hooks, etc. (optional)
- `components/*View.tsx` — screen UI; dialogs colocated here

### Composite modules (`dashboard`, `profile`)

UI-only. Compose other features’ queries/mutations; no API client of their own.

### Roles

Queries-only. Use `useWorkspaceRoles` / `useProjectRoles` plus pure helpers
`roleById` / `workspaceRoleByName` / `projectRoleByName`. Assignable/invitable role lists
for UIs come from `lib/authz/can.ts`.

## Architecture Patterns (align new work with these)

### Query cache shapes

- **List** hooks return the full `Paginated<T>` envelope `{ data, meta }`.
- **Detail** (and members) hooks unwrap `.data` in `queryFn` so consumers get the entity
  (or array) directly.
- Register keys in `lib/query/keys.ts`. Use shared stale times from `lib/query/staleTime.ts`.
- Lists often use `placeholderData: keepPreviousData`.

### Controlled dialogs

Create/invite dialogs are controlled by the parent View (`open` / `onOpenChange`). The View
owns the trigger so the same dialog can open from headers and empty states.

### URL filters (nuqs)

Use factories in `lib/filters/` (`createListFiltersHook`, `createMultiSelectFiltersHook`).

**Board vs Issues:** Issues table filters (`status`, `priority`, …) and board filters
(`boardPriority`, `boardAssignee`, …) use **separate URL key namespaces** so Board ↔ Issues
navigation does not clash. Do not reuse Issues param names on the board.

### Forms & errors

- RHF + `@hookform/resolvers/zod`.
- Map `VALIDATION_ERROR` field details with `handleFormError` from `lib/forms/handleFormError.ts`.
- Transport throws `ApiError`; UI behavior:
  - `401` → clear session, redirect `/login`
  - `403` → `NoAccessState`
  - `404` → not-found / empty
  - mutation failures → Sonner toasts (and form mapping when validation)

### Authorization (UI-only)

- `can()`, `useCan()`, `<PermissionGate>` decide what to **show** (hide/disable + reasons).
- **Never treat client checks as security** — the backend enforces every rule.
- Gate create/invite/role-change actions with `PermissionGate` / `can()` the same way
  existing Views do.

### Auth session

- Token + actor in Zustand (`stores/authStore.ts`), persisted; transport attaches
  `Authorization: Bearer`.
- `(app)/layout` uses `AuthGuard`. Login lives under `(auth)/login`.

## Reusable Helpers (prefer these over new one-offs)

| Area                 | Use                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API client           | `src/lib/api/client/*`                                                                                                                                                                              |
| Schemas / types      | `src/lib/api/schemas/*`                                                                                                                                                                             |
| Query keys / stale   | `src/lib/query/keys.ts`, `staleTime.ts`                                                                                                                                                             |
| List / multi filters | `src/lib/filters/*`                                                                                                                                                                                 |
| Form API errors      | `src/lib/forms/handleFormError.ts`                                                                                                                                                                  |
| Authz UI             | `src/lib/authz/{can,useCan,PermissionGate}`                                                                                                                                                         |
| Labels / icons       | `src/lib/labels/*`                                                                                                                                                                                  |
| Format / cn          | `src/lib/format.ts`, `src/lib/utils.ts`                                                                                                                                                             |
| Common UI            | `DataTable`, `PageHeader`, `FilterBarShell`, `PaginationBar`, badges, `EmptyState`, `FilterAwareEmptyState`, `ErrorState`, `NoAccessState`, `ConfirmDialog`, `OptionSelect`, `MultiSelectFilter`, … |

## Naming & Code Style

- Components: PascalCase files (`ProjectsView.tsx`). Hooks: `useX`. Clients: `projectsClient`.
- Feature data files: `queries.ts`, `mutations.ts`, `constants.ts`, `options.ts`.
- `'use client'` on interactive Views, hooks, mutations — not on most thin route pages.
- Match existing Prettier settings (single quotes, semicolons, trailing commas, printWidth 100).

## Contract Alignment (required)

Do **not** invent endpoints, query params, or response shapes only on the client. Align
`lib/api/schemas`, `lib/api/client`, and transport usage with the server.

When implementing or changing frontend behavior that depends on the API, resolve the
contract in this order:

1. `server/docs/openapi.json` (and `/docs` when the API is running) — paths, bodies, status codes
2. Zod in `server/src/modules/<resource>/` — if OpenAPI lags the code
3. `openspec/specs/<capability>/spec.md` — behavior / authz intent  
   (`projects`, `issues`, `project-members`, `user-management`, `authorization`, `query-parameters`)
4. `docs/04-api/api-design.md` and domain docs under `docs/` — only when product meaning is unclear

Then update frontend schemas/clients to match. Server OpenAPI + server Zod own the API.

## Tests

**Do not add frontend tests** (no `*.test.*` / `*.spec.*`, no test runner or test config)
unless the user **explicitly** asks for them. This is temporary policy.

## After Every Implementation

From `app/`, in order:

1. `npm run prettier`
2. `npm run lint` — fix all errors and warnings
3. `npx tsc --noEmit` — fix all TypeScript errors

Do not add a `typecheck` script to `package.json`.

## Local Development

- Env: copy `.env.sample` → `.env.local`. `NEXT_PUBLIC_API_BASE_URL` defaults to
  `http://localhost:5000/api/v1`.
- Dev: `npm run dev` (http://localhost:3000). Server must already be running (see root / server docs).
- Bootstrapped logins come from `server/.env.local` (`OWNER_EMAIL` / `ADMIN_EMAIL` / `DEVELOPER_EMAIL`).
