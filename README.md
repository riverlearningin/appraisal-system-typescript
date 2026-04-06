# Brodersen Appraisal System

Comprehensive technical documentation for the full-stack appraisal platform.

## 1. Project Overview

Brodersen Appraisal System is a role-aware performance appraisal platform with:

- Multi-level review workflows (self, manager, management)
- Cycle-based appraisal windows
- Dynamic and predefined appraisal sections
- Reporting with role-based visibility controls
- Cookie-based authentication with role switching in UI
- Admin tooling for users, cycles, and sections

This repository is a monorepo with two independently runnable applications:

- `backend` (NestJS + Prisma + PostgreSQL)
- `frontend` (Next.js App Router + TypeScript + Tailwind + Zustand)

## 2. High-Level Architecture

### Backend

- Framework: NestJS 11
- Language: TypeScript
- ORM: Prisma 7
- Database: PostgreSQL
- Auth: JWT in HttpOnly cookie
- Authorization: route guards + role metadata

### Frontend

- Framework: Next.js 16 (App Router)
- Language: TypeScript
- State: Zustand (auth state + active role)
- HTTP client: Axios (cookie credentials enabled)
- Styling: Tailwind CSS v4

### Runtime defaults

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:3000`

## 3. Repository Layout

```text
brodersen-appraisal-system/
  backend/
    src/
      auth/
      users/
      reviews/
      cycles/
      sections/
      prisma/
      common/
    prisma/
      schema.prisma
      seed.ts
      migrations/
  frontend/
    app/
      (auth)/
      (dashboard)/
    components/
      auth/
      layout/
      ui/
    lib/
      api/
      auth/
    store/
    types/
```

## 4. Backend Deep Dive

## 4.1 Module wiring

`backend/src/app.module.ts` composes:

- `AuthModule`
- `UsersModule`
- `ReviewsModule`
- `CommonModule`
- `PrismaModule`

It also registers `CyclesController` + `SectionsController` and their services directly.

## 4.2 Configuration and bootstrapping

`backend/src/main.ts`:

- Loads env via `dotenv`
- Applies `cookie-parser`
- Enables CORS with `credentials: true`
- CORS origin from `FRONTEND_URL` (fallback `http://localhost:3000`)
- Starts on `PORT` (fallback `3001`)

## 4.3 Data model (Prisma)

Core models in `backend/prisma/schema.prisma`:

- `User`
- `Role`
- `UserRole` (join table)
- `UserHierarchy` (employee -> manager)
- `Cycle`
- `Section`
- `Point`
- `Review`
- `ReviewResponses`

Important constraints and semantics:

- `User.email` is unique
- `Role.name` is unique
- `UserRole` composite primary key (`userId`, `roleId`)
- `UserHierarchy` unique per employee (`employeeId`)
- `Review` unique (`cycleId`, `employeeId`, `reviewerId`)
- `ReviewResponses` unique (`reviewId`, `pointId`)

Dynamic point ownership:

- `Point.employeeId` exists and is nullable
- Global/template points: `employeeId = null`
- Personal dynamic points: `employeeId = <reviewed employee id>`

Cycle-level response visibility controls:

- `Cycle.showManagerResponses` (default true)
- `Cycle.showManagementResponses` (default true)

## 4.4 Authentication and authorization

### Authentication flow

- `POST /auth/login`
  - Validates credentials using bcrypt
  - Issues JWT containing `sub`, `email`, `roles`
  - Stores token in `access_token` HttpOnly cookie
- `GET /auth/me`
  - Decodes JWT from cookie using Passport strategy
  - Returns `{ userId, email, roles }`
- `POST /auth/logout`
  - Clears cookie
- `POST /auth/change-password`
  - Validates current password and updates hash

JWT strategy:

- Token source: cookie `access_token`
- Secret: `JWT_SECRET`
- Expiry: configured via `JwtModule` (`1d`)

### Authorization flow

- `JwtAuthGuard` enforces authenticated requests
- `RoleGuard` reads `@Roles()` metadata and checks `request.user.roles`
- Controllers apply guards at class and route level

## 4.5 Domain behavior

### Review generation

`POST /reviews/generate/:cycleId`:

- Generates reviews for active cycle
- Includes self, manager, and second-level management reviewers
- Skips self-reviews for `management` and `admin`
- Excludes `admin` as reviewer role in generated chain

### Draft and submit behavior

Draft save (`/reviews/add-response`):

- Allows partial/incomplete responses
- Prevents editing submitted reviews
- Validates point belongs to cycle and employee scope

Submit (`/reviews/submit/:id`):

- Requires complete comments for all accessible points
- Requires ratings for non-dynamic points
- Uses employee-scoped point set (global + that employee personal points)

### Dynamic points

`POST /reviews/add-dynamic-point`:

- Only employee self-review can create
- Only within dynamic sections
- Saved with `employeeId = review.employeeId`
- Personal dynamic points are visible only in that employee's review/report context

### Reports

`GET /reviews/report/:employeeId`:

- Management role only
- Report payload includes section/point response matrix
- Applies cycle visibility flags for manager/management response visibility
- Filters points by employee scope (global + employee-owned dynamic)

`GET /reviews/report-summaries`:

- Bulk score summary endpoint for dashboards
- Reduces N+1 report fetch pattern
- Returns `{ [employeeId]: overallScore | null }`

### Team traversal

`GET /users/my-team-all`:

- Uses iterative traversal with visited sets
- Prevents infinite loops from cyclic hierarchy data

`POST /users/assign-manager`:

- Validates no circular reporting chain can be created

## 4.6 Backend API reference

### Auth

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/change-password`

### Users

- `POST /users`
- `POST /users/assign-role`
- `POST /users/assign-manager`
- `GET /users/my-team`
- `GET /users/my-team-all`
- `GET /users/my-profile`
- `GET /users/roles`
- `GET /users`
- `PATCH /users/:id`
- `DELETE /users/:id`

### Cycles

- `GET /cycles`
- `POST /cycles`
- `PATCH /cycles/:id/status`
- `PATCH /cycles/:id/response-visibility`

### Sections

- `GET /sections`
- `POST /sections`
- `POST /sections/:id/points`

### Reviews

- `POST /reviews/create`
- `POST /reviews/add-response`
- `POST /reviews/add-dynamic-point`
- `POST /reviews/submit/:id`
- `GET /reviews/manager`
- `POST /reviews/generate/:cycleId`
- `GET /reviews/my`
- `GET /reviews/report/:employeeId` (management only)
- `GET /reviews/report-summaries`
- `GET /reviews/:id`

## 5. Frontend Deep Dive

## 5.1 App Router structure

- `app/(auth)/login`
- `app/(dashboard)/dashboard`
- `app/(dashboard)/reviews`
- `app/(dashboard)/reviews/[id]`
- `app/(dashboard)/reports`
- `app/(dashboard)/profile`
- `app/(dashboard)/admin/users`
- `app/(dashboard)/admin/cycles`
- `app/(dashboard)/admin/sections`
- `app/(dashboard)/access-denied`

## 5.2 Global app shell and auth initialization

- Root layout mounts `AuthInitializer` and global `PoweredByBadge`
- Dashboard layout enforces authentication and role-based route access
- Unauthorized route access redirects to `/access-denied`

## 5.3 Auth state management

`frontend/store/auth.store.ts`:

- Zustand store fields:
  - `user`
  - `activeRole`
  - `isLoading`
  - `isInitialized`
- Persisted state: only `activeRole`
- `initialize()` hydrates user via `/auth/me`
- `login()` performs login and retries `/auth/me` for cookie propagation
- Role switching is constrained to roles included in authenticated user payload

## 5.4 API layer

- Base client: `frontend/lib/api/client.ts`
  - Base URL from `NEXT_PUBLIC_API_URL` (fallback `http://localhost:3001`)
  - `withCredentials: true` for cookie auth
  - Automatic redirect to `/login` on 401

Feature API modules:

- `auth.api.ts`
- `reviews.api.ts`
- `users.api.ts`
- `admin.api.ts`

## 5.5 Route authorization policy

`frontend/lib/auth/route-access.ts` defines allowed roles per route pattern.

Notable enforced rules:

- Admin pages are admin-only
- Review fill/list pages exclude admin
- Reports page is management-only

## 5.6 Reports and print behavior

Reports page:

- Fetches employee reports via backend report endpoint
- Uses role-aware table column rendering
- Supports print mode with print-specific layout classes
- Heading and logo print alignment are handled in page markup and print classes

Global print behavior in `app/globals.css`:

- A4 landscape
- 10mm page margins
- Sidebar/header/nav hidden in print
- Tables forced to fixed layout
- Word wrapping enabled in table cells

## 6. Full review lifecycle (request path)

1. Admin creates and activates cycle
2. Admin creates sections/points
3. Management generates reviews for cycle
4. Employee/manager/management fill responses
5. Draft saves persist partial content
6. Submit validates completeness
7. Management views and prints reports

## 7. Environment variables

## Backend

- `DATABASE_URL` PostgreSQL connection string
- `JWT_SECRET` token signing/verification secret
- `FRONTEND_URL` CORS allowed origin
- `PORT` backend listen port
- `NODE_ENV` controls secure cookie setting

## Frontend

- `NEXT_PUBLIC_API_URL` backend API base URL

## 8. Local setup guide

## Prerequisites

- Node.js 20+ recommended
- npm
- PostgreSQL instance

## Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Database setup

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
npx ts-node prisma/seed.ts
```

For development with local schema iteration, `migrate dev` may be used instead of `migrate deploy`.

## Run backend

```bash
cd backend
npm run start:dev
```

## Run frontend

```bash
cd frontend
npm run dev
```

## Production builds

```bash
cd backend
npm run build

cd ../frontend
npm run build
```

## 9. Migrations and data evolution notes

Recent data model additions include:

- Unique review response per point
- Cycle-level response visibility flags
- Employee-scoped dynamic points (`Point.employeeId`)

When pulling new changes:

1. Apply migrations
2. Regenerate Prisma client
3. Restart backend

## 10. Performance and reliability patterns

Implemented patterns include:

- Bulk report summaries endpoint to avoid per-employee report N+1 calls
- Retry logic around initial auth/session hydration on frontend login
- Iterative hierarchy traversal to avoid recursive hangs and cycle loops

## 11. Security model and boundaries

- Primary trust boundary is backend authorization
- Frontend route checks improve UX and preempt invalid navigation
- Backend still enforces final permission checks for sensitive resources

## 12. Testing and quality status

- Backend has standard Nest test scripts configured
- Frontend compiles with Next + TypeScript build checks
- Lint scripts exist in both apps
- E2E coverage is minimal and should be expanded for critical flows

## 13. Recommended future improvements

- Add API contract docs (OpenAPI/Swagger)
- Add integration tests for review generation and submit validation
- Add e2e browser tests for role-restricted routes
- Add audit logging for admin actions
- Add CI pipeline with migration + build + test gates

## 14. Troubleshooting quick reference

- 401 from frontend API: check auth cookie, `withCredentials`, backend CORS origin
- Report access denied: ensure current active role is `management`
- Dynamic points not visible: verify they were created in employee self-review and migration for `Point.employeeId` is applied
- Team endpoints slow/hanging: verify hierarchy has no cycles and latest backend build is running

---

This README is intended as the canonical technical guide for onboarding and maintenance of the complete stack.
