# Engineering Standards — Abraj Al Yasir Tasks API

Mandatory for every module from Phase 2 onward. Users/Roles/Permissions (this
phase) is the reference implementation — when in doubt, match its shape.

## 1. Folder structure
Every module lives at `src/modules/<name>/` with: `<name>.module.ts`,
`<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`, `dto/`,
and (only if the module has a distinct sub-resource) `interfaces/`. Shared
code goes in `src/common/` (`decorators/`, `guards/`, `filters/`,
`interceptors/`, `middleware/`, `dto/`, `utils/`, `constants/`) — never
duplicated per-module.

## 2. Response format
- Single resource: the raw DTO/object, no envelope.
- List endpoint: always `{ data: T[], meta: { page, page_size, total, total_pages } }`
  — build `meta` with `common/utils/pagination.util.ts#buildPaginationMeta`, never by hand.
- Mutation with nothing to return: `204 No Content`.
- Errors: always `{ error: { code, message, correlationId, details? } }` —
  owned by `GlobalExceptionFilter`, never overridden per-module.

## 3. Global exception handling
Throw Nest's built-in exceptions (`NotFoundException`, `ConflictException`,
`ForbiddenException`, etc.) or pass a `{ code, message }` object as the
exception payload for a custom `code`. Never catch-and-format errors inside a
controller — the `GlobalExceptionFilter` is the only place response shape is
decided.

## 4. Logging
Inject nothing — request-level logging is automatic via `LoggingInterceptor`
+ `CorrelationIdMiddleware` (already global). Inside services, use Nest's
`Logger` for anything beyond the request lifecycle (background jobs, startup).
Never `console.log` in application code.

## 5. Repository pattern
A `*.repository.ts` is **only** a thin Prisma wrapper: one method per query
shape, typed with `Prisma.<Model>FindManyArgs` etc., zero business rules,
zero thrown domain exceptions. Skip a repository only for a module with a
single trivial query with no reuse potential (rare — Auth's Phase 1
simplification is the one exception so far, and even that should graduate
to a repository once it grows).

## 6. Service layer
All business rules live here: validation beyond DTO shape (uniqueness,
state-machine legality, System-Owner protection), orchestration across
repositories, and wrapping related writes in `prisma.$transaction`. Services
depend on Repositories, never on `PrismaService` directly except for
transaction orchestration that spans multiple repositories.

## 7. Validation
Every request body/query is a `class-validator` DTO. Global
`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
is already set in `main.ts` — never add a second, differently-configured
pipe. Path params use `ParseUUIDPipe` (or the relevant built-in pipe) inline
in the controller, not manual parsing.

## 8. Pagination
Every list endpoint's query DTO extends `common/dto/pagination-query.dto.ts`
(`page`, `page_size`, `search`, `sort`, `order`). Compute `skip`/`take` with
`paginationSkipTake()`. Never accept an unbounded "return everything" query.

## 9. Filtering & sorting
Filter fields are flat query params matching column names (see
`QueryUsersDto` for the pattern). Sorting takes a `sort` (column name) +
`order` (`asc`/`desc`) pair — never a single combined string to parse.
Validate `sort` against an explicit allow-list of sortable columns in the
service before passing it to Prisma's `orderBy` (prevents arbitrary-column
injection).

## 10. Prisma transaction guidelines
Wrap in `prisma.$transaction(...)` whenever more than one write must succeed
or fail together: creating a row plus its audit-log entry, creating a user
plus its role assignment, replacing a whole permission matrix, rotating a
refresh token. Use the **array form** when every write's inputs are already
known; use the **interactive form** (`async (tx) => {...}`) the moment a
later write depends on an earlier write's result or on a read that must be
re-checked inside the same transaction (see `TokenService.rotateRefreshToken`
for the canonical example).

## 11. Testing strategy
- **Unit**: one `*.spec.ts` per Service, mocking its Repository — tests
  business rules (System Owner protection, transition legality, uniqueness)
  without a database.
- **Integration**: one `*.e2e-spec.ts` per module hitting real routes against
  a test database (docker-compose test profile), covering the permission
  matrix itself — a Manager token must get 403 on an Employee-forbidden
  route, a non-owner token must get 403 on every `@SystemOwnerOnly()` route.
  RBAC correctness is the single highest-value thing to cover with real
  integration tests, precisely because a unit test mocking the guard away
  would prove nothing about it.
- Coverage is not graded on a target percentage; it's graded on whether every
  branch in a Service's business rules (not just its happy path) has a test.

## 12. API versioning
`/api/v1/...` for everything, via Nest's URI versioning (`defaultVersion: '1'`
in `main.ts`) — never per-controller version decorators unless a future
breaking change genuinely needs `v2` to coexist with `v1`.

## 13. Code style & naming
- Files: `kebab-case.ts`. Classes: `PascalCase`. Variables/methods: `camelCase`.
- DTO field names: `snake_case`, matching the wire format exactly (see rule 2)
  — even though this is unusual for TypeScript, it keeps request/response
  bodies byte-identical to the approved API Specification with no mapping
  layer to drift out of sync.
- One class per file. No default exports — always named exports.
- A Controller method is a routing statement, not a place to think — if it's
  more than ~5 lines, the logic belongs in the Service.

## 14. Reusable utilities
Before writing a helper, check `src/common/utils/`. Pagination math lives in
`pagination.util.ts`. Add new shared helpers there — never re-implement
skip/take math or meta-object shaping inside a Service.

## 15. Shared constants & enums
`src/common/constants/permission.constants.ts` is the single source of truth
for `PermissionModule` and `PermissionAction` — every `@RequirePermission()`
call across every module imports from there. Adding a new gated module or
action means adding one enum member here, then a matching row in
`scripts/seed.ts`'s `MODULES`/`ACTIONS` arrays — never a bare string literal
in a decorator call.

## 16. Performance guidelines
- Every list query needs an index backing its primary filter — check
  `prisma/schema.prisma`'s `@@index` list before shipping a new filter field;
  add the index in the same PR if it's missing.
- Never `findMany` without `take` (rule 8).
- Prefer one query with `include`/relation loading over N+1 sequential
  queries in a loop.
- Multi-write Service methods use transactions (rule 10) for correctness —
  but keep transactions short (no network calls, no email sends inside one);
  side effects that can happen after commit (queueing a notification) should
  fire after the transaction resolves, not inside it.

## 17. Security checklist (every new module, before merge)
- [ ] Every mutating route has `@RequirePermission(module, action)`.
- [ ] Every route that must be System-Owner-exclusive per the approved model
      also has `@SystemOwnerOnly()` — permission grants alone are never
      sufficient for those (a Manager could theoretically be granted
      `users:manage` and must still be blocked).
- [ ] No route trusts a role name, permission, or scope from the JWT payload
      beyond `roleId`/`isSystemOwner`/`mustChangePassword` — everything else
      is re-derived from the database per request (`PermissionsGuard`).
- [ ] Every `@Body()` and `@Query()` param has a typed DTO — no bare `any`.
- [ ] Every soft-deletable entity's queries filter `deletedAt: null` by
      default; hard delete is never exposed over the API for those entities.
- [ ] Passwords: `argon2` only, never logged, never returned in any response
      except the one-time `temporary_password` field on user creation/reset.
