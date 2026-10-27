# Unified platform — Abraj Al Yasir

One login and one permission model for the company's four portals:

| Portal | Path (frontend) | What it holds |
|---|---|---|
| بوابة الشركة `company` | `/company` | HR: employees, attendance, leaves, payroll, announcements, plants and equipment, every project |
| مجمع الرئاسة `riyasa` | `/p/riyasa` | Units, bookings, installments, daily site reports, maintenance |
| مجمع القضاة `qudah` | `/p/qudah` | Same as riyasa, for the judges' complex |
| نظام المهام `tasks` | `/dashboard` | The existing tasks engine, plus proof photos, printing and the file hub |

## How access is decided

Every request passes three independent checks, all on the server:

1. **Permission** (`module`, `action`) from the user's role, with a **scope**: `all` (whole company), `department` (own department), `own` (own records). Roles are edited from the Roles screen.
2. **Portal access** (`UserPortalAccess`): *where* a user may work. Set per user from Users → «البوابات». The company portal oversees every project portal; module permissions still apply inside it. The System Owner always has every portal.
3. **Row scope** inside each service: e.g. a sales officer with `re-bookings:own` sees only their own bookings, and a department manager's file hub is locked to their department whatever they ask for.

The frontend hides what a user cannot do (`usePermission().can`), but it is only a convenience. The API re-checks every request.

### Starting roles (seed)

| Role | Main grants |
|---|---|
| General Manager | everything, scope `all` |
| Department Manager | HR modules with approve (department), file hub (department), department announcements, read-only projects and assets |
| HR Officer | employees, attendance, leaves (approve), payroll (open, edit, submit), announcements |
| Accountant | payroll approve and mark paid, installment collection, read bookings |
| Sales Officer | units (view), bookings and maintenance tickets (own), installments (view own) |
| Site Engineer | daily site reports (own), tickets, attendance roll-call for their department |
| Employee | own leaves, own HR record, announcements |

## Business rules enforced by the API

- **Proof of completion:** a task cannot go to review (or in progress → completed) without at least one `proof` attachment while the setting `tasks.proof_required` is on. The error is `422 PROOF_REQUIRED`, and the web app opens the camera/scanner when it gets it.
- **Leaves:** no overlapping requests; nobody approves their own; a rejection needs a reason; an approval writes `on_leave` into attendance for each day.
- **Payroll:** draft → review → approved → paid. Whoever opened the month cannot approve it. Entries lock after draft.
- **Bookings:** the unit is claimed atomically (available → reserved, or sold when a deposit is paid). The client is matched by phone. A booking with any paid installment cannot be cancelled.
- **Installments:** paid in full only (`AMOUNT_MISMATCH` otherwise). "Overdue" is computed from the due date and is never stored.
- **Site reports:** one per engineer, site and day; no future dates.
- **Attendance:** no future dates. Employees outside the recorder's scope are rejected as a batch (`OUT_OF_SCOPE`).

## New endpoints (all under `/api/v1`)

```
GET  /me/portals                 GET|PUT /users/:id/portals
GET|POST /hr/employees           GET|PATCH /hr/employees/:id
GET  /hr/attendance?date=        GET /hr/attendance/summary?date=     PUT /hr/attendance
GET|POST /hr/leaves              PATCH /hr/leaves/:id/decision        PATCH /hr/leaves/:id/cancel
GET|POST /payroll/periods        GET /payroll/periods/:id[/entries]   PATCH /payroll/entries/:id
POST /payroll/periods/:id/{submit|approve|mark-paid}
GET|POST /announcements          DELETE /announcements/:id
GET|POST /assets/plants          GET|POST /assets/equipment           PATCH /assets/equipment/:id
GET  /projects                   GET /projects/:key                   GET /projects/:key/sites/:code/summary
GET  /projects/:key/units        PATCH /projects/:key/units/:id
GET|POST /projects/:key/bookings PATCH /projects/:key/bookings/:id/{confirm|cancel}
GET  /projects/:key/installments POST /projects/:key/installments/:id/pay
GET|POST /projects/:key/site-reports
GET|POST /projects/:key/tickets  PATCH /projects/:key/tickets/:id
GET  /file-hub                   GET /file-hub/summary                GET /activity-logs
GET  /attachments                POST /tasks/:id/attachments/base64   GET /attachments/:id/file
```

## Running it

```bash
cp .env.example .env              # set DATABASE_URL, REDIS_URL (or REDIS_HOST/PORT/PASSWORD), JWT keys
npm ci
npx prisma db push                # creates the new tables (additive)
npm run seed                      # roles, permissions, projects, sites, unit types, plants
SEED_DEMO_DATA=true DEMO_PASSWORD='Demo@2026!' npm run seed   # optional demo staff and data
npm run start:dev
```

Demo users are `*@demo.abraj` (for example `fatima@demo.abraj` is a department manager, `ali@demo.abraj` a sales officer for Riyasa only). Do not enable `SEED_DEMO_DATA` in production.

Frontend: set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`, then `npm ci && npm run build`.

## Deploying on Railway

The API deploys from `railway.toml` (Dockerfile build, healthcheck `/api/v1/health`).
On every start `docker/entrypoint.sh` runs `prisma db push`, then the compiled seed
(`dist/scripts/seed.js`, built by `npm run build`), then the API.

1. Add the **Postgres** and **Redis** plugins to the project.
2. On the API service set:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (includes the password Railway Redis requires) |
| `JWT_ACCESS_PRIVATE_KEY_BASE64` / `JWT_ACCESS_PUBLIC_KEY_BASE64` | from `bash scripts/generate-jwt-keys.sh` |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | the frontend origin, e.g. `https://<site>.netlify.app` |
| `SYSTEM_OWNER_EMAIL` / `SYSTEM_OWNER_PASSWORD` | a real password, not the default |

3. Deploy, then check `GET /api/v1/health/ready` returns `{"status":"ready"}` (database and Redis both `ok`).

`prisma db push` runs with `--accept-data-loss`. The unified-platform schema is additive, but
take a database backup before deploying any later schema change that drops or renames a column.
