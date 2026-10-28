# Abraj Al Yasir Tasks

Internal enterprise task-management platform for Abraj Al Yasir. Arabic-first (full RTL), System-Owner-led RBAC, department/task engine with lifecycle, dependencies, checklists, comments, attachments, notifications, activity log, and scoped dashboards/reports.

## Frontend (Next.js 15)

The real frontend application lives in `frontend/` — React 19, Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui-style primitives, TanStack Query, React Hook Form + Zod, Socket.IO client, Axios, Framer Motion. It consumes the backend exclusively over HTTP/WebSocket — no mock data anywhere.

### Run the frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3001 (or whatever port `next dev` picks) — set `NEXT_PUBLIC_API_URL` (default `http://localhost:3000/api/v1`) and `NEXT_PUBLIC_WS_URL` (default `http://localhost:3000`) in `.env.local` to point at your running backend.

### What's implemented

Login + first-login forced password change, role-aware Dashboard (Executive/Team/Personal), Tasks (list with filters/pagination, create, full detail page with status transitions/checklist/threaded comments/watchers/reassign/dependencies/activity history), Kanban (drag-and-drop status changes), Calendar (month view by due date), Departments (nested tree, create/archive/restore), Positions (CRUD), Users (create with one-time temp password display, transfer, reset-password, activate/deactivate), Notifications (list + live push via Socket.IO + polling fallback), Reports (real scoped data per report type + client-side CSV export), Profile (view + change password + notification prefs), Settings (System-Owner-only company key/values), Audit Logs (filterable).

Every page is wrapped in `RequireAuth`, which redirects to `/login` when unauthenticated and to `/change-password` when the session's `must_change_password` flag is set — both enforced again server-side regardless of what the UI does. Navigation and in-page actions are filtered through `usePermission()`, which mirrors the backend's `PermissionsGuard` scope resolution read once at login via `GET /me` — the API re-checks every request itself, so this is a convenience layer, never the real boundary.

### Known simplifications (disclosed, not hidden)

- File upload UI (attachments) calls through to the real `upload-url` → confirm flow is scaffolded but the actual browser file picker + progress UI isn't wired yet — the backend's storage abstraction (local-disk stand-in behind the same interface MinIO/S3 would use) is ready for it.
- PDF/Excel report exports show real data and log a real audit event; the file itself is CSV-only client-side today, matching the backend's own disclosed placeholder for file generation.
- Task creation's priority/status pickers now use the two new lookup endpoints (`GET /task-statuses`, `GET /task-priorities`) added in this phase — no more guessing an id from an unrelated query.

## Project layout

```
.
├── Abraj Al Yasir Tasks.dc.html   Approved interactive UI prototype (design reference)
├── *.dc.html                      Planning docs: architecture, business rules, DB/API design (read-only reference)
├── design_handoff_abraj_al_yasir_tasks/   Static handoff bundle for a frontend implementer
├── src/                           Backend source (NestJS)
├── prisma/                        Prisma schema (schema.prisma)
├── scripts/                       JWT key generation + DB seed
├── docker/                        Dockerfile, entrypoint, prod compose
├── test/                          e2e specs
├── docker-compose.yml             One-command local stack (Postgres + Redis + API)
└── .env.example
```

**Frontend implementation status:** the UI has a complete, approved interactive design (`Abraj Al Yasir Tasks.dc.html`) and a handoff package (`design_handoff_abraj_al_yasir_tasks/`) — but no real React/Next.js application has been built yet that calls this API. What's runnable today with `docker compose up` is the **backend only**. Building the actual frontend app against these endpoints is the natural next phase.

## Run everything with one command

```bash
cp .env.example .env
bash scripts/generate-jwt-keys.sh
docker compose up --build
```

That's it. On startup the API container automatically applies the Prisma schema to Postgres and seeds baseline data (statuses, priorities, the 3 system roles + their permission matrix, one bootstrap department, and the System Owner account) — both steps are idempotent, so re-running `docker compose up` is always safe.

- API: http://localhost:3000/api/v1
- Swagger docs: http://localhost:3000/api/docs
- Health (liveness): http://localhost:3000/api/v1/health
- Readiness (DB + Redis check): http://localhost:3000/api/v1/health/ready

**Seeded System Owner login:** `owner@abrajalyasser.iq` / `ChangeMe123!` (forced password change on first use — every route except `/auth/change-password` and `/auth/logout` returns `403 FORCE_PASSWORD_CHANGE` until it's changed).

## Run without Docker (local Node + a Docker-only Postgres/Redis)

```bash
cp .env.example .env
bash scripts/generate-jwt-keys.sh
docker compose up -d postgres redis
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

## Tests

```bash
npm test            # unit tests
npm run test:e2e     # integration tests — needs postgres + redis running and seeded
```

## Production

`docker/docker-compose.prod.yml` is the hardened variant (no dev volume mounts, explicit restart policy, resource limits, includes its own Redis service). It expects `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` as real environment variables (no `.env` file baked in) and a committed `prisma/migrations` folder applied via `prisma migrate deploy` as part of your deploy pipeline — the `db push` auto-apply in the dev entrypoint is a local-convenience shortcut, not meant for production.

### Deploying to Railway

1. Push this repo to GitHub and create a new Railway project from it — `railway.toml` at the repo root tells Railway to build `docker/Dockerfile`.
2. Add the **Postgres** and **Redis** plugins from Railway's marketplace; it injects `DATABASE_URL` automatically — copy the Redis plugin's host/port into `REDIS_HOST` / `REDIS_PORT` on the API service.
3. Run `bash scripts/generate-jwt-keys.sh` locally and paste its two printed `JWT_ACCESS_*_BASE64` values into the API service's environment variables.
4. Set `NODE_ENV=production`, `CORS_ORIGIN` (your real frontend origin), and `SYSTEM_OWNER_PASSWORD` (never deploy with the published default).
5. Deploy. The container's entrypoint applies the schema and seeds baseline data (including the System Owner) automatically, retrying if Postgres isn't reachable yet.

### Deploying to Render

1. Push this repo to GitHub and create a new **Blueprint** from it in Render — it reads `render.yaml` at the repo root and provisions a Postgres database, a Redis instance, and the API web service together.
2. After the first deploy, open the API service's Environment tab and fill in the `sync: false` variables `render.yaml` reserved: `JWT_ACCESS_PRIVATE_KEY_BASE64` / `JWT_ACCESS_PUBLIC_KEY_BASE64` (from `bash scripts/generate-jwt-keys.sh`), `CORS_ORIGIN`, and `SYSTEM_OWNER_PASSWORD`.
3. Trigger a manual redeploy so the new environment variables take effect.
4. Render's health check hits `/api/v1/health` (liveness) automatically per `healthCheckPath`; `/api/v1/health/ready` is available for a deeper DB+Redis check if you wire up a separate monitor.

### Verifying a clean deployment

The full cold-start path — env validation → JWT key resolution → `prisma db push` (with retry) → seed (with retry, idempotent, race-safe against concurrent instances) → `node dist/main` → `/api/v1/health` → `/api/v1/health/ready` — was traced end-to-end for correctness while making these changes. Actually executing a live deploy isn't possible from this environment; after deploying, confirm it yourself with:

```bash
curl https://<your-deployment-url>/api/v1/health         # expect {"status":"ok",...}
curl https://<your-deployment-url>/api/v1/health/ready    # expect {"status":"ready","checks":{"database":"ok","redis":"ok"}}
curl -X POST https://<your-deployment-url>/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"<SYSTEM_OWNER_EMAIL or default>","password":"<SYSTEM_OWNER_PASSWORD or default>"}'
# expect a 200 with access_token/refresh_token and force_password_change:true
```

## What's implemented (backend)

Auth (JWT/RS256 + rotating refresh tokens), Users, Roles & Permissions (dynamic RBAC + System Owner model), Departments (unlimited nested hierarchy) & Positions, User Transfers, Tasks (full lifecycle state machine, dependencies with blocking, multi-assignee, watchers, subtasks), Task Checklists, Task Comments (threaded, mentions, edit history), Attachments (versioned, presigned-URL storage abstraction), Notifications, Activity Log, Saved Filters, Dashboard (Executive/Team/Personal, Redis-cached), Reports (scoped export requests, audit-logged). See `ENGINEERING_STANDARDS.md` for the conventions every module follows.

## Not yet built

The real frontend application; MinIO/S3 wiring for the storage abstraction (currently a local-disk stand-in behind the same interface); PDF/Excel/CSV file generation for report exports (the export request itself is real and audited; only the file-writing step is a placeholder); Socket.IO live push (notifications are DB-backed and pollable today).
