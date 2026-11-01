# Repository Instructions

**myjira** is a Jira-like workspace/project tool split into two independent packages (no root
workspace, no root `package.json`). Install and run only inside `app/` or `server/`.

## Map

| Path                     | Role                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `app/`                   | Next.js frontend — read `app/AGENTS.md` before editing        |
| `server/`                | Express + Prisma API — read `server/AGENTS.md` before editing |
| `docs/`                  | Product, domain, architecture, API design                     |
| `openspec/`              | Spec-driven change artifacts (`specs/`, `changes/`)           |
| `.cursor/rules/backend/` | Backend test / repository patterns (auto-attach by glob)      |

## Where to work

- **UI, hooks, forms, routes, client schemas** → `app/` (+ `app/AGENTS.md`)
- **API, DB, authz enforcement, server tests** → `server/` (+ `server/AGENTS.md`)
- **Product / domain meaning** → `docs/` first
- **Capability wording already captured as specs** → `openspec/specs/`

Use OpenSpec (propose / apply / archive skills and `opsx-*` commands) **only when the user
explicitly** starts or continues that workflow.

## Contract ownership

Server OpenAPI (`server/docs/openapi.json`) and server Zod own the API. Frontend Zod under
`app/src/lib/api/schemas` must mirror them — never ship a client-only endpoint or response shape.

## Local run (short)

1. In `server/`: `npm install` → `compose:up` → `db:migrate` → `db:seed` → `npm run dev`
2. In `app/`: `npm install` → copy `.env.example` → `.env.local` → `npm run dev`

Seed users: `OWNER_EMAIL` / `ADMIN_EMAIL` / `DEVELOPER_EMAIL` (and passwords) in `server/.env.local`.

## Tests (package policies)

- **Frontend:** do not add tests unless the user explicitly asks — details in `app/AGENTS.md`.
- **Backend:** tests are required where that package’s conventions say so — follow
  `server/AGENTS.md` and `.cursor/rules/backend/*`.
