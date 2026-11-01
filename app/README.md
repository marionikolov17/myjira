# MyJira (frontend)

Role-aware issue tracker UI (workspace → projects → issues). Talks to the MyJira REST API
over HTTP. Agent/architecture conventions live in [`AGENTS.md`](./AGENTS.md).

## Getting started

```bash
# in ../server
npm install
npm run compose:up         # starts Postgres for local dev
npm run db:migrate
npm run db:seed
npm run dev                # listens on PORT from server/.env.local (typically 5000)

# in ./app
npm install
cp .env.sample .env.local   # NEXT_PUBLIC_API_BASE_URL → http://localhost:5000/api/v1
npm run dev
```

Open http://localhost:3000 and sign in with a bootstrapped account from `server/.env.local`
(`OWNER_EMAIL` / `ADMIN_EMAIL` / `DEVELOPER_EMAIL` and their passwords).

API contract: `../server/docs/openapi.json` (Swagger UI at the API’s `/docs` when the server is running).

## Environment

| Variable                   | Default                        | Description                      |
| -------------------------- | ------------------------------ | -------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5000/api/v1` | Base URL of the MyJira REST API. |

## Scripts

| Script             | Command              |
| ------------------ | -------------------- |
| `npm run dev`      | Next.js dev server   |
| `npm run build`    | Production build     |
| `npm run start`    | Serve production     |
| `npm run lint`     | ESLint               |
| `npm run prettier` | Format with Prettier |
