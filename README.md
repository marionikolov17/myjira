[![CodeFactor](https://www.codefactor.io/repository/github/marionikolov17/myjira/badge)](https://www.codefactor.io/repository/github/marionikolov17/myjira)

### API Folder Structure (Example)

```
src/
│
├── app.ts
├── server.ts
│
├── config/
│ ├── env.ts
│ ├── database.ts
│ └── logger.ts
│
├── modules/
│ ├── users/
│ │ ├── user.controller.ts
│ │ ├── user.service.ts
│ │ ├── user.repository.ts
│ │ ├── user.schema.ts
│ │ ├── user.types.ts
│ │ └── user.routes.ts
│ │
│ ├── projects/
│ │ ├── project.controller.ts
│ │ ├── project.service.ts
│ │ ├── project.repository.ts
│ │ ├── project.schema.ts
│ │ ├── project.types.ts
│ │ └── project.routes.ts
│ │
│ └── ...
│
├── common/
│ ├── middleware/
│ │ ├── auth.middleware.ts
│ │ ├── error.middleware.ts
│ │ └── request-id.middleware.ts
│ │
│ ├── utils/
│ │ ├── pagination.ts
│ │ ├── sorting.ts
│ │ └── filtering.ts
│ │
│ ├── errors/
│ │ ├── app-error.ts
│ │ ├── error-codes.ts
│ │ └── http-error.ts
│ │
│ ├── authorization/
│ │ ├── permission-map.ts
│ │ ├── authorize.ts
│ │ └── roles.ts
│ │
│ └── types/
│ └── express.d.ts
│
├── database/
│ ├── migrations/
│ ├── seeders/
│ └── models/
│
├── tests/
│ ├── unit/
│ └── integration/
│
└── docs/
└── openapi.yaml
```
