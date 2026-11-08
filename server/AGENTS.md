# Project Instructions

Backend API for **myjira** (a Jira-like workspace/project tool). This file tells agents how the
server is structured and the conventions to follow. Read it before creating or editing files.

## Stack

- **Language/runtime**: TypeScript (strict), ESM (`"type": "module"`), Node.
- **Web**: Express 5, `express-rate-limit`, `swagger-ui-express` (spec at `docs/openapi.json`, served at `/docs`).
- **Persistence**: Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`) on PostgreSQL. Schema at `prisma/schema.prisma`; migrations in `prisma/migrations/`; seed at `prisma/seed.ts`.
- **Validation**: Zod (`*.schema.ts`).
- **Auth**: `jsonwebtoken`, `bcrypt`.
- **Logging**: Winston (behind a facade).
- **Tests**: Jest (ESM) + Supertest.
- **Path alias**: `@/*` → `src/*` (configured in `tsconfig.json`). Prefer `@/` imports over long relative paths.

## Project Structure

```
server/
├── prisma/                  # schema.prisma, migrations/, seed.ts
├── docs/openapi.json        # served at /docs
├── src/
│   ├── app.ts               # express app: middleware order + controller mounting
│   ├── server.ts            # entrypoint
│   ├── config/              # env parsing/typing + feature config
│   ├── generated/           # Prisma-generated client (do not edit)
│   ├── common/
│   │   ├── activation-token/ # activation-token facade + types
│   │   ├── authorization/   # declarative authz matrix + guard (source of truth for authz)
│   │   ├── errors/          # AppError taxonomy + error-codes (see below)
│   │   ├── interfaces/      # shared interfaces (IRepository, actor context, ...)
│   │   ├── lib/prisma.ts    # Prisma client
│   │   ├── logger/          # Winston facade
│   │   ├── middlewares/     # authentication, require-authentication, logger-request, error
│   │   ├── password-hasher/ # bcrypt facade
│   │   ├── query/           # list-query engine: parse page/sort/filter → Prisma queries
│   │   ├── schema/          # shared Zod schemas (id)
│   │   ├── token-service/   # JWT facade
│   │   ├── types/           # ambient type declarations (express.d.ts)
│   │   ├── unit-of-work/    # transactional unit of work over Prisma
│   │   └── utils/           # map-prisma-error, map-zod-error, is-plain-object, create-test-app, redact-token-query-param
│   └── modules/             # auth, issues, project-members, project-roles, projects, users, workspace, workspace-roles
└── tests/{unit,integration}/
```

## Module Layout

Each module in `src/modules/<name>/` contains:

- `<name>.controller.ts` — owns an Express `Router`, validates input, calls the service, shapes the response.
- `<name>.service.ts` — business logic.
- `<name>.repository.ts` — Prisma persistence (implements `IRepository`, exposes `resourceName`).
- `<name>.schema.ts` — Zod schemas for request validation.
- `<name>.query-config.ts` — declarative list-query config (sortable/filterable fields, page sizes) consumed by `common/query` (list-bearing resources only: `users`, `projects`, `issues`).
- `<name>.interface.ts` — interfaces for the above (mock/inject against these, never concrete classes).
- `<name>.types.ts` — domain/DTO types.
- `index.ts` — wires dependencies (DI) and exports singletons (see below).

Resource modules carry the full set; service-only modules (`auth`, `workspace`) and role
catalogs (`workspace-roles`, `project-roles`) omit the roles they don't need (repository,
types, query-config). `auth` additionally hosts the actor-context service
(`actor-context.service.ts` + `actor-context.interface.ts`).

## Architecture & Conventions

- **Layering**: controller → service → repository. Keep each layer decoupled; business logic stays in the service, persistence stays in the repository.
- **Dependency Injection**: classes take collaborators via constructor, typed to interfaces. `index.ts` instantiates and wires singletons, e.g.:

```typescript
const authService = new AuthService(userRepository, tokenService, passwordHasher, logger);
const authController = new AuthController(authService);
export { authController };
```

- **Facades for infrastructure**: third-party libs (JWT, bcrypt, Winston, Prisma) are hidden behind an interface + facade in `common/`. Depend on the interface, not the library.
- **Routing**: controllers build their own `Router` in the constructor via a private `registerRoutes()`. Mount them in `app.ts` under `/api/v1/<name>`.
- **Middleware order (in `app.ts`)**: `express.json` → rate limit → request logger → authentication → routes → `errorMiddleware` (last).
- **Validation**: in the controller, guard non-objects with `isPlainObject`, then `Schema.parse(body)`. Do not validate in services.
- **Responses**: success responses use `{ data: ... }`. Never send errors from controllers — `catch (error) { next(error); }` and let `errorMiddleware` handle them.
- **Errors**: throw the typed errors from `@/common/errors` (`ConflictError`, `AuthorizationError`, `AuthenticationError`, `ResourceNotFoundError`, `ValidationError`, `BusinessRuleViolationError`, `InvalidLoginCredentialsError`). Map external failures with `map-prisma-error` / `map-zod-error`. Do not throw raw `Error`.
- **Authorization**: services enforce access via the injected `IAuthorizationGuard` — `authorize({ actor, scope, action, resource })`. Allowed roles are declarative data in `common/authorization/authorization-matrix.ts`; unconfigured actions are denied by default. Add new actions to the matrix, never as inline checks.
- **List queries**: paginated/filterable/sortable endpoints use the shared engine in `common/query` (parser → Prisma mapper), configured per resource via `<name>.query-config.ts`; repositories return `Paginated<T>` (see `.cursor/rules/backend/repository-paginated-list.mdc`).

## Naming

- Interfaces are `I`-prefixed (`IUserRepository`, `IAuthService`).
- Files are kebab-case with a role suffix: `.controller.ts`, `.service.ts`, `.repository.ts`, `.schema.ts`, `.query-config.ts`, `.interface.ts`, `.types.ts`.

## Code Style

- Order declarations top-down, from most-depended-on to most-dependent. A reader should be able to follow the call graph by scrolling down.
  1. **Module-level setup first**: in a class, the `constructor`; in a function file, top-level `type`/`const` declarations.
  2. **Shared helpers** (private/internal, used by 2+ parents) sit above the parents.
  3. **Parent/exported functions** follow, in a logical public-API order.
  4. **Single-parent helpers** sit directly below the one parent that calls them, in call order.
- Example (class — `src/modules/users/user.service.ts`): `constructor` → `assertAssignableRole` (shared) → `createUser` → `buildActivationUrl` (helper of `createUser`) → `listUsers` → `updateUserRole`.
- Example (function file — `src/common/utils/map-prisma-error.ts`): `type ErrorMapper` + `PRISMA_ERROR_MAP` + `PG_CHECK_VIOLATION_CODE` (module setup) → `mapPrismaError` (exported parent) → `getUnderlyingPgCode` + `getModelName` (single-parent helpers of `mapPrismaError`).
- Always run `npm run prettier` after code changes.
- Always run `npm run lint` after code changes.

## Local Development

- Env files: `.env.local` (dev), `.env.test` (integration). Commands load them via `dotenv`.
- Start DB: `npm run compose:up` (stop with `compose:down`).
- Run migrations / seed: `npm run db:migrate`, `npm run db:seed`.
- Dev server: `npm run dev`. Build: `npm run build`. Prod: `npm run start`.

## Tests

### Unit Tests

- **Before creating or editing any file under `server/tests/unit/`, you MUST `Read` the rule file `.cursor/rules/backend/unit-tests-pattern.mdc` into context.** It is auto-attached by its glob when you open an existing unit-test file, but when writing a brand-new test with no sibling test opened, you must read it explicitly. Do not write or edit a unit test without this rule loaded.
- Follow the unit-test conventions in `.cursor/rules/backend/unit-tests-pattern.mdc` (mock factories, interface-based mocks, structure, fixtures). Match the existing style exactly.
- Unit tests mirror `src/` under `tests/unit/`; shared mocks live in `tests/unit/mocks/`.
- Run unit tests with only this command: `npm run test:unit`
- Run unit tests with coverage with only this command: `npm run test:unit:coverage`

### Integration Tests

- **Before creating or editing any file under `server/tests/integration/`, you MUST `Read` the rule file `.cursor/rules/backend/integration-tests-pattern.mdc` into context.** It is auto-attached by its glob when you open an existing integration-test file, but when writing a brand-new test with no sibling test opened, you must read it explicitly. Do not write or edit an integration test without this rule loaded.
- Follow the integration-test conventions in `.cursor/rules/backend/integration-tests-pattern.mdc` (real Express + Prisma/Postgres via Supertest, test-context factories wiring real collaborators, co-located fixtures/assertions, shared error assertions). Match the existing style exactly.
- Integration tests mirror `src/modules/` under `tests/integration/modules/`; shared DB seeding/fixtures live in `tests/integration/fixtures/` and shared error assertions in `tests/integration/assertions/`.
- Each subject gets three co-located files: `<name>.controller.test.ts` (the only `*.test.ts`), `<name>.controller.fixtures.ts`, and `<name>.controller.assertions.ts`.
- Do NOT mock collaborators — integration tests exercise the real pipeline against the test DB. Only use `jest.spyOn` on wired-in dependencies to inject failures.
- Run integration tests with only this command: `npm run test:integration` (spins up the test DB via Docker)

### All Tests

- Run all tests (unit and integration) with only this command: `npm run test`
