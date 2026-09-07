# AWS Route53 Clone — Master Implementation Specification (v2)

## Non-negotiable instructions for the agent — read first, re-read before every phase

1. **The assignment specification is the source of truth.** This document is a plan for
   executing that spec — it is not permission to add unrelated functionality. Where any
   instruction below conflicts with the assignment, the assignment wins.
2. **Do not proceed to the next phase until every acceptance criterion of the current
   phase passes.** No "mostly done." Report status against the checklist before moving on.
3. **UI fidelity is a first-class requirement, not a side effect of the component
   library.** Using Cloudscape does NOT automatically make the UI Route53-identical.
   For every screen, compare the implementation against the real Route53 console
   (screenshots/reference) before marking that screen's task complete. Customize
   Cloudscape components wherever the real console's spacing, density, wording,
   or layout differs from Cloudscape defaults.
4. **Authentication must include resource-level authorization.** A logged-in user must
   only ever see/edit/delete their own hosted zones and records — never another
   user's, even by guessing an ID.
5. **Every state must be designed, not accidental**: loading, empty, error, success,
   unauthorized, validation-failure, and destructive-confirmation states are all
   required for every table/form, not optional polish.
6. **Explicitly out of scope, at all times:** real DNS resolution, real DNS
   propagation, real nameserver delegation, real AWS IAM, real Route53 API calls,
   querying actual nameservers, generating real AWS resources. If a task starts to
   feel like "build a DNS engine," stop — it has drifted out of scope.
7. **Do not invent Route53's navigation ordering or screen layout.** Reproduce what the
   actual current Route53 console does, based on reference screenshots. If genuinely
   unable to verify a detail, pick the most conservative/standard AWS console pattern
   and note the assumption in `docs/assumptions.md`.

---

## Scope Boundary

| IN SCOPE | OUT OF SCOPE |
|---|---|
| CRUD on Hosted Zones (DB rows only), scoped per-user | Real DNS resolution, propagation, zone transfers |
| CRUD on DNS Records (DB rows, shape-validated) | Real nameserver delegation |
| Mocked authentication + real resource-level authorization | Real IAM, Cognito, OAuth |
| Route53-identical UI/UX (nav, tables, forms, modals, search, filters, pagination, notifications) | Novel UX not present in real Route53 |
| Dashboard / Traffic Policies / Health Checks / Resolver / Profiles as static "Coming Soon" pages | Any real logic behind those placeholder pages |

---

## Tech Stack (simplified from v1 — fewer moving parts, per review feedback)

**Frontend:** Next.js 14 (App Router) + TypeScript + `@cloudscape-design/components` +
`@cloudscape-design/global-styles` + TanStack Query (server state) + Zod (form validation)
+ native `fetch`. No Zustand — notifications and small UI state use React Context.

**Backend:** FastAPI + SQLAlchemy + Pydantic v2 + Alembic + SQLite (`aiosqlite`) + a
current, maintained password-hashing library (e.g. `bcrypt` via `passlib[bcrypt]`, or
`argon2-cffi` — verify current best practice at implementation time rather than assuming).

**Auth mechanism:** **Opaque server-side session token**, not JWT. Rationale: this is a
*mocked* auth system for a CRUD assignment — a JWT-in-middleware architecture forces the
Next.js middleware to either (a) blindly trust cookie presence without verifying it
(not real auth) or (b) duplicate JWT-secret verification logic in Next.js (unnecessary
complexity). A DB-backed session table avoids both problems and is trivially easy to
reason about:
- `sessions` table: `id, user_id, token_hash, created_at, expires_at`
- Cookie holds the raw token; backend hashes and looks it up on every request.
- Next.js middleware does **presence-only** redirect (if no cookie → redirect to
  `/login`); the actual authorization check always happens server-side in FastAPI on
  every request via a `get_current_user` dependency. The frontend never trusts its own
  cookie-presence check as "the user is authenticated" — it's only a UX shortcut to
  avoid flashing protected content; FastAPI is the real gatekeeper.

**Testing:** Pytest (backend, written alongside each backend phase — not deferred) +
Playwright (frontend E2E — **mandatory**, not optional).

**Deployment:** Backend on a host with a **verified persistent volume** for the SQLite
file (verify current provider support at implementation time — don't assume). Frontend
on Vercel.

---

## Data Model (revised)

```
User
 │ 1:N
 ├──> Session
 │
 └──> HostedZone
         │ 1:N
         └──> DnsRecord
```

**`users`**
| column | type | notes |
|---|---|---|
| id | int PK | |
| username | str, **UNIQUE** | |
| password_hash | str | |
| created_at | datetime | |

**`sessions`**
| column | type | notes |
|---|---|---|
| id | int PK | |
| user_id | int FK → users.id | |
| token_hash | str | raw token only ever lives in the cookie |
| created_at | datetime | |
| expires_at | datetime | |

**`hosted_zones`**
| column | type | notes |
|---|---|---|
| id | int PK | |
| user_id | int FK → users.id | **required — enforces per-user ownership** |
| name | str | normalized (see Phase 1 rules) |
| comment | str, nullable | |
| type | enum(public, private) | |
| created_at | datetime | |
| updated_at | datetime | |
| — | — | **`record_count` is NOT a stored column** — computed via `COUNT(dns_records.id)` at read time to avoid drift between stored and actual counts |

Constraint: `UNIQUE(user_id, name)` — same normalized domain name can't be duplicated
for one user.

**`dns_records`**
| column | type | notes |
|---|---|---|
| id | int PK | |
| hosted_zone_id | int FK → hosted_zones.id, ON DELETE CASCADE | |
| name | str | |
| type | enum(A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA, SOA) | **SOA added as an internal system type** — see Phase 4 |
| ttl | int, default 300 | |
| values | JSON | structured per type, see API contract below — not a flat string |
| routing_policy | str, default "Simple" | cosmetic field only |
| is_default | bool, default false | true for the auto-created NS/SOA records |
| created_at | datetime | |
| updated_at | datetime | |

`PRAGMA foreign_keys = ON;` must be set on every SQLite connection so that
`ON DELETE CASCADE` actually works — SQLite does not enforce this by default.

### Structured `values` per record type (API contract, not arbitrary strings)

| Type | `values` shape |
|---|---|
| A | `["192.0.2.1", "192.0.2.2"]` (list of IPv4 strings) |
| AAAA | `["2001:db8::1"]` (list of IPv6 strings) |
| CNAME | `["target.example.com"]` (exactly one) |
| TXT | `["v=spf1 -all"]` (list of strings) |
| MX | `[{"priority": 10, "host": "mail.example.com"}]` |
| NS | `["ns1.example.com", "ns2.example.com"]` |
| PTR | `["host.example.com"]` (exactly one) |
| SRV | `[{"priority": 10, "weight": 5, "port": 443, "target": "svc.example.com"}]` |
| CAA | `[{"flag": 0, "tag": "issue", "value": "letsencrypt.org"}]` |
| SOA (internal) | `[{"mname": "...", "rname": "...", "serial": 1, "refresh": 7200, "retry": 900, "expire": 1209600, "minimum": 300}]` |

The backend stores this as JSON internally in all cases; Pydantic uses a
type-discriminated schema so the API itself is typed and self-documenting, rather than
pushing string-parsing responsibility onto the frontend.

### Domain-name / record-name normalization rules (define once, apply everywhere)
- Lowercase the name.
- Strip a single trailing dot if present before storing (`example.com.` → `example.com`),
  but display with the trailing dot in the UI where Route53 does (zone name).
- Reject names that don't match a basic hostname/domain shape (`^[a-z0-9.-]+$`, no
  leading/trailing hyphen per label).
- Apply the same normalization before uniqueness checks so `Example.com` and
  `example.com.` are treated as the same zone.

### Record-name collision rules (lightweight, not full DNS semantics)
- A `CNAME` record cannot coexist with any other record type at the same normalized
  `name` within the same hosted zone (including `A`, `AAAA`, `TXT`, `NS`, etc.).
- Enforce this at the service layer on create/update, return `409` with a clear error
  code (see error contract below) if violated.

---

## API Contract Conventions (apply from Phase 2 onward)

### HTTP status code matrix
| Code | Meaning |
|---|---|
| 200 | successful GET/PUT |
| 201 | successful POST |
| 204 | successful DELETE |
| 400 | malformed request |
| 401 | unauthenticated (no/invalid session) |
| 403 | authenticated but not authorized (resource belongs to another user) |
| 404 | resource not found |
| 409 | conflict (duplicate zone, zone not empty, CNAME collision, default-record delete) |
| 422 | validation error (per-field, from Pydantic) |
| 500 | unexpected server error |

### Error response shape (every error, no exceptions)
```json
{
  "error": {
    "code": "HOSTED_ZONE_NOT_EMPTY",
    "message": "This hosted zone contains custom DNS records. Delete them before deleting the zone."
  }
}
```
Frontend maps known `code` values to specific UI copy; unknown codes fall back to
`message`. Never show raw backend exceptions or JSON dumps in the UI.

Known error codes to implement: `INVALID_CREDENTIALS`, `SESSION_EXPIRED`,
`ZONE_NOT_FOUND`, `ZONE_NAME_TAKEN`, `HOSTED_ZONE_NOT_EMPTY`, `RECORD_NOT_FOUND`,
`DEFAULT_RECORD_PROTECTED`, `CNAME_COLLISION`, `VALIDATION_ERROR`, `FORBIDDEN`.

### CORS & cookies
- Explicit `allow_origins` list (never `"*"`) — dev: `http://localhost:3000`; prod: the
  actual deployed frontend origin, read from an env var.
- Cookie flags: `HttpOnly`, `Secure` in production, `SameSite=Lax` (or `None`+`Secure`
  if frontend/backend end up on different domains in production — decide once
  deployment targets are known), `Path=/`, expiration matching `sessions.expires_at`.

### `.env.example` (both frontend and backend, committed; real `.env` never committed)
```
# backend/.env.example
DATABASE_URL=sqlite+aiosqlite:///./app.db
SESSION_SECRET=change-me
CORS_ORIGINS=http://localhost:3000
SESSION_TTL_HOURS=24

# frontend/.env.example
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Exact Route Map (frontend)

```
/login

/dashboard                                          (Coming Soon)

/hosted-zones                                        (list)
/hosted-zones/[id]                                   (detail — records table)

/traffic-policies                                    (Coming Soon)
/health-checks                                        (Coming Soon)
/resolver                                             (Coming Soon)
/profiles                                              (Coming Soon)
```

Create/edit for both hosted zones and records happen in **side panels** launched from
the list/detail pages (matching the real Route53 pattern), not separate routes — do not
invent `/hosted-zones/new` or `/records/new` pages unless reference screenshots show
Route53 using a dedicated page instead of a panel for that specific action. Verify this
against the reference in Phase 0 before building Phase 7/8; note the confirmed pattern
in `docs/assumptions.md`.

---

## Phase 0 — Reference Study & Visual Specification

**Goal:** A concrete, written visual/interaction spec exists for every screen before any
UI code is written. This phase directly serves the "look and feel exactly the same"
requirement and is treated as equally important as any functional phase.

### Tasks
1. Collect reference screenshots (or detailed notes) of the real Route53 console for:
   - Top navigation bar, left side navigation (exact item list and order)
   - Hosted zones list page (columns, header, buttons, search bar position, pagination)
   - Create hosted zone panel (fields, order, side panel vs. modal, button labels)
   - Hosted zone detail page (header, records table, tabs if any)
   - Create/edit record panel, including per-record-type field layout
   - Delete confirmation pattern for zones and records (Route53 requires typing the
     resource name for zone deletion — verify and replicate)
   - Empty states (zero zones, zero records)
   - Notification/toast pattern and position
2. For each screen, write a short checklist in `docs/visual-spec.md`:
   ```
   ## Hosted Zones List
   - [ ] Page header text matches
   - [ ] Table columns: Domain name, Type, Record count, Comment (confirm exact set/order)
   - [ ] Search box position (top-left of table toolbar)
   - [ ] Create button position (top-right of table toolbar)
   - [ ] Pagination position (bottom-right)
   - [ ] Row click behavior confirmed (navigates to detail)
   - [ ] Empty state copy/CTA confirmed
   ```
3. Confirm and document: side panel vs. modal usage per action, exact left-nav item
   list/order, exact table column sets, exact delete-confirmation pattern.
4. Note any detail you could not verify in `docs/assumptions.md` with your chosen
   fallback and reasoning — never guess silently.
5. Scaffold the repo:
   ```
   route53-clone/
   ├── frontend/
   ├── backend/
   ├── docs/
   │   ├── architecture.md
   │   ├── ERD.md
   │   ├── api.md
   │   ├── visual-spec.md
   │   └── assumptions.md
   ├── docker-compose.yml
   └── README.md
   ```
6. Init Next.js (TS, App Router) in `frontend/`; init FastAPI in `backend/`; install
   the trimmed dependency list from the Tech Stack section above.
7. `docker-compose.yml` with a named volume for the SQLite file.

### Acceptance criteria
- [ ] `docs/visual-spec.md` exists with a checklist for every screen listed above
- [ ] `docs/assumptions.md` exists (may be short, but the file exists and is used
      throughout the project whenever a detail can't be verified)
- [ ] Repo structure matches above; both services boot locally
- [ ] No DNS-resolution libraries anywhere in dependencies

---

## Phase 1 — Database, Migrations, Seed Data

**Goal:** Schema from the Data Model section above is live, migrated, and seeded —
seed data exists now, not late in the project, so every later UI phase has realistic
data to build against.

### Tasks
1. SQLAlchemy models for `users`, `sessions`, `hosted_zones`, `dns_records` exactly per
   the Data Model section (including `UNIQUE(user_id, name)` on zones, FK cascade on
   records, `PRAGMA foreign_keys = ON` set on connection).
2. Alembic initial migration.
3. `docs/ERD.md` — mermaid ER diagram + column tables (can lift directly from this doc).
4. `backend/app/seed.py` — creates:
   - One mock user (document credentials in README)
   - 3 sample hosted zones, each with its default NS + SOA records already present, plus:
     - `example.com` — one record of every user-creatable type (A, AAAA, CNAME, TXT,
       MX, NS, PTR, SRV, CAA) so every table/form path has real data to exercise
     - `api.example.com` — a couple of A records
     - `dev.example.com` — a CNAME record
5. Run seed against local DB, verify via `/docs` (Swagger) once Phase 2 stubs exist,
   or via a direct DB query for now.

### Acceptance criteria
- [ ] Migration runs cleanly on a fresh SQLite file
- [ ] Foreign key cascade verified (deleting a zone via direct DB test removes its records)
- [ ] Seed script produces 1 user + 3 zones with realistic records, including one of
      every type
- [ ] `docs/ERD.md` complete

---

## Phase 2 — Backend: Authentication + Authorization

**Goal:** Login/logout/session-persistence works, and every subsequent protected route
enforces both authentication (valid session) and authorization (resource belongs to the
requesting user).

### Endpoints
- `POST /api/auth/login` — validate against `users`, create a `sessions` row, set
  httpOnly cookie with the raw token
- `POST /api/auth/logout` — delete the session row, clear cookie
- `GET /api/auth/me` — resolve session → user, 401 if invalid/expired/absent

### Tasks
1. `backend/app/core/security.py` — password hashing (verify current best-practice
   library at implementation time), session token generation (cryptographically random),
   token hashing for storage.
2. `backend/app/deps.py`:
   - `get_current_user` — resolves session cookie → user or raises 401
   - `get_owned_hosted_zone` — resolves `{zone_id}` **and** checks `zone.user_id ==
     current_user.id`, raising 403 (not 404 — but see note) if not. *Note:* many real
     APIs return 404 instead of 403 for other-users'-resources to avoid confirming the
     resource exists; pick 404 for this reason and document the choice in `docs/api.md`.
3. `backend/app/api/v1/auth.py` — the three endpoints, applying `CORS_ORIGINS` and
   cookie flags from the API Contract Conventions section.
4. Pytest: login success/failure, `/me` with/without valid cookie, logout invalidates
   the session row (a re-used old cookie must fail), session expiry enforced.

### Acceptance criteria
- [ ] Login sets a session row + cookie; `/me` returns the correct user
- [ ] Logout deletes the session row; the old cookie no longer authenticates
- [ ] Expired sessions are rejected with 401 + `SESSION_EXPIRED`
- [ ] All tests pass

---

## Phase 3 — Backend: Hosted Zones CRUD (with ownership)

**Goal:** Full CRUD, every route scoped to `current_user`, using the shared error
contract and status matrix.

### Endpoints
| Method | Path | Behavior |
|---|---|---|
| GET | `/api/hosted-zones?q=&page=&limit=&sort=` | list **only this user's** zones; search by normalized name; paginate; sort (implement real sort — see Phase 7 note on keeping backend/frontend consistent) |
| POST | `/api/hosted-zones` | create — normalize name, enforce `UNIQUE(user_id, name)` → 409 `ZONE_NAME_TAKEN` on violation; **in one transaction**, also insert default NS + SOA records with `is_default=true` |
| GET | `/api/hosted-zones/{id}` | detail, 404 if not found or not owned |
| PUT | `/api/hosted-zones/{id}` | edit — **only `comment` is editable**; `name` and `type` are immutable after creation (document this explicitly in the UI too — see Phase 7) |
| DELETE | `/api/hosted-zones/{id}` | delete — block with 409 `HOSTED_ZONE_NOT_EMPTY` if any non-default record exists; default NS/SOA records are ignored by this check |

`record_count` in the list/detail response is computed via `COUNT(dns_records.id)` at
query time — not stored.

### Tasks
1. Pydantic schemas: `HostedZoneCreate` (name, comment, type), `HostedZoneUpdate`
   (comment only), `HostedZoneOut` (includes computed `record_count`),
   `HostedZoneListResponse` (items + pagination metadata: `total`, `page`, `limit`).
2. `backend/app/services/hosted_zone_service.py` — normalization, transactional create
   (zone + default records together, rolled back together on failure), delete-block logic.
3. `backend/app/api/v1/hosted_zones.py`, all routes behind `get_current_user` +
   ownership check.
4. Pytest: create (verify default records + transaction rollback on simulated failure),
   list (only own zones, never another user's), search, paginate, sort, edit
   (comment-only), delete-blocked, delete-succeeds-with-only-defaults,
   cross-user-access-returns-404.

### Acceptance criteria
- [ ] All 5 endpoints implemented, auth + ownership enforced
- [ ] Creating a zone is transactional (zone + NS + SOA all-or-nothing)
- [ ] A second user cannot see, edit, or delete User A's zones (404, not leaking existence)
- [ ] Delete correctly blocked/allowed per the non-default-record rule
- [ ] `record_count` always matches actual record count (no drift possible, since it's
      computed, not stored)
- [ ] All tests pass

---

## Phase 4 — Backend: DNS Records CRUD (with validation + collision rules)

**Goal:** Full CRUD scoped to a zone the user owns, with structured per-type validation.

### Endpoints
| Method | Path | Behavior |
|---|---|---|
| GET | `/api/hosted-zones/{zone_id}/records?q=&type=&page=&limit=&sort=` | list within an owned zone; search; filter by type; paginate; sort |
| POST | `/api/hosted-zones/{zone_id}/records` | create, validated per type; enforce CNAME-collision rule → 409 `CNAME_COLLISION` |
| PUT | `/api/hosted-zones/{zone_id}/records/{record_id}` | edit — **`type` is immutable**; only `name`, `ttl`, `values`, `routing_policy` are editable (see rationale below) |
| DELETE | `/api/hosted-zones/{zone_id}/records/{record_id}` | delete — 409 `DEFAULT_RECORD_PROTECTED` if `is_default=true` |

**Type-immutability rationale:** changing a record's type mid-edit is not a metadata
update in real DNS consoles — it's structurally a different record (different validation
shape, different rendering). The UI (Phase 8) will show `type` as read-only on edit; a
user who wants a different type deletes and creates a new record.

### Per-type validation (implement using `ipaddress.ip_address()` for A/AAAA — do not
hand-roll IP regexes)
- **A** — each value parses as `ipaddress.IPv4Address`
- **AAAA** — each value parses as `ipaddress.IPv6Address`
- **CNAME** — exactly one hostname-shaped value; collision rule applies
- **TXT** — one or more string values
- **MX** — one or more `{priority: int, host: str}`
- **NS** — one or more hostname-shaped values
- **PTR** — exactly one hostname-shaped value
- **SRV** — one or more `{priority, weight, port, target}`, `port` in `1..65535`
- **CAA** — one or more `{flag: int, tag: "issue"|"issuewild"|"iodef", value: str}`
- **SOA** (internal only — never user-creatable via API; reject `POST` with `type=SOA`)

### Tasks
1. Pydantic discriminated-union schema on `type`, one variant per type above (per the
   Data Model's structured `values` contract).
2. `backend/app/services/dns_record_service.py` — validation dispatch, CNAME-collision
   check, default-record protection.
3. `backend/app/api/v1/dns_records.py`, nested under an owned zone.
4. Pytest: one valid + one invalid payload per user-creatable type; CNAME collision
   (create A then attempt CNAME at same name → 409, and vice versa); edit (type-change
   attempt rejected); delete-blocked-for-default; delete-blocked-for-cross-user;
   attempting to create `type=SOA` via API is rejected.

### Acceptance criteria
- [ ] All 4 endpoints implemented, auth + ownership enforced
- [ ] Every record type validates correctly; malformed input returns 422 with per-field
      detail
- [ ] CNAME collision enforced both directions
- [ ] Default records cannot be deleted or have their type changed
- [ ] `SOA` cannot be created directly via the API
- [ ] All tests pass

---

## Phase 5 — Frontend: App Shell (per the Visual Spec from Phase 0)

**Goal:** Route53 chrome built once, matching `docs/visual-spec.md` exactly for nav and
notifications — verified against reference, not assumed from Cloudscape defaults.

### Tasks
1. `components/layout/TopNav.tsx` — Cloudscape `TopNavigation`, matching the confirmed
   reference: service title, mock region selector (static), account menu with Logout.
2. `components/layout/SideNav.tsx` — Cloudscape `SideNavigation` using the **exact item
   list/order confirmed in Phase 0**, not an assumed order.
3. `components/layout/Breadcrumbs.tsx`.
4. Notification system: React Context + Cloudscape `Flashbar`, positioned per the
   reference. Every mutation across the app pushes a toast here (success and error).
5. `middleware.ts` — **presence-only** cookie check → redirect to `/login` if absent.
   Explicitly document in a code comment that this is a UX shortcut only; the real
   authorization boundary is FastAPI's `get_current_user`/ownership checks (Phase 2/3/4).
6. `app/(dashboard)/layout.tsx` — wraps protected pages in TopNav + SideNav +
   Breadcrumbs + Flashbar. Responsive behavior (see Phase 10) applies here.

### Acceptance criteria
- [ ] Every item in `docs/visual-spec.md`'s nav checklist is checked off against the
      running app, not assumed
- [ ] Unauthenticated access to any `(dashboard)` route redirects to `/login`
      (middleware), **and** a direct API call without a valid session still returns 401
      (backend is the real gate)
- [ ] Flashbar can be triggered from any component and displays a toast

---

## Phase 6 — Frontend: Login & Session Persistence

### Tasks
1. `app/login/page.tsx` — form per the reference (or a reasonable AWS-sign-in-style
   layout if Route53's actual login isn't in scope for pixel-matching — document this
   assumption), calls `POST /api/auth/login`, redirects to `/hosted-zones` on success,
   shows the mapped error message (`INVALID_CREDENTIALS`) on failure.
2. `lib/auth.ts` — `useAuth()` hook calling `GET /api/auth/me` on app load.
3. Logout button in TopNav calls `POST /api/auth/logout`, clears client state,
   redirects to `/login`.

### Acceptance criteria
- [ ] Valid login redirects into the app; invalid login shows an inline, specific error
- [ ] Refresh mid-session keeps the user logged in (session row still valid)
- [ ] Logout invalidates the session server-side (verified: reusing dev tools to keep
      the old cookie after logout fails against the API)

---

## Phase 7 — Frontend: Hosted Zones

**Goal:** Full CRUD UI with URL-persisted list state and explicit editable-field rules.

### Tasks
1. `app/(dashboard)/hosted-zones/page.tsx` — Cloudscape `Table`, columns confirmed in
   `docs/visual-spec.md`.
2. **URL-persisted state**: `q`, `page`, `limit`, `sort` all reflected in the URL query
   string (e.g. `/hosted-zones?q=example&page=2`), so refresh preserves state. Changing
   `q` or a filter resets `page` to 1.
3. Sorting: since the backend supports `sort` (Phase 3), implement clickable
   column-header sorting in the UI so the two stay consistent — do not leave backend
   sort support unused.
4. Pagination: page-size selector (10/20/50/100) + "Showing X–Y of Z" label, per
   Cloudscape's standard pattern.
5. "Create hosted zone" → side panel (name, comment, type radio) → `POST` → Flashbar
   success → list invalidated/refetched (TanStack Query). On `ZONE_NAME_TAKEN`, show an
   inline field error, not a generic toast.
6. Row click → `/hosted-zones/[id]`.
7. Edit action → panel with **comment only** (name/type shown read-only, per Phase 3's
   editable-field rule) → `PUT`.
8. Delete action → confirmation modal requiring the user to type the domain name to
   confirm (per Phase 0's verified reference pattern) → `DELETE` → on
   `HOSTED_ZONE_NOT_EMPTY`, show that specific message inline in the modal, not a
   generic failure.
9. Empty state (zero zones) matching the reference copy/CTA.
10. Unsaved-changes guard on the create/edit panel: closing via outside-click or Escape
    with dirty form state prompts "Discard unsaved changes?" before closing.

### Definition of Done (apply this checklist to this phase and every later feature phase)
- [ ] Backend implemented and tested
- [ ] Persistence verified (data survives a backend restart)
- [ ] Frontend implemented
- [ ] Loading state present
- [ ] Empty state present
- [ ] Error state present (mapped error codes, not raw errors)
- [ ] Success notification present
- [ ] Client + server validation present
- [ ] Cross-user access tested (403/404, never someone else's data)
- [ ] Refresh preserves relevant state (URL params)
- [ ] No console errors/warnings
- [ ] UI checked against `docs/visual-spec.md`

---

## Phase 8 — Frontend: DNS Records

**Goal:** Full CRUD UI within a zone, with type-driven forms and clean type-switch
behavior.

### Tasks
1. `app/(dashboard)/hosted-zones/[id]/page.tsx` — zone summary header + records table.
2. Records table columns per `docs/visual-spec.md` (typically: Record name, Type,
   Routing policy, TTL, Value).
3. URL-persisted search (`q`), type filter (`type`), pagination, sort — same pattern as
   Phase 7.
4. `components/records/RecordForm.tsx` — single component whose field set swaps based
   on selected `type`, using the structured `values` shapes from the Data Model. On
   type change (create flow only — type is immutable in edit per Phase 4):
   - Clear all type-specific field values (no stale `A` value leaking into an `MX` form)
   - Clear validation errors
   - Reset to type-appropriate defaults (`TTL=300`, `routing_policy="Simple"`, empty
     type-specific fields)
5. "Create record" → panel using `RecordForm` → `POST`. On `CNAME_COLLISION`, show the
   specific inline error naming the conflicting record.
6. Edit action → same `RecordForm`, pre-filled, **`type` field disabled/read-only** with
   a note ("To change the record type, delete this record and create a new one").
7. Delete action → confirmation modal; default (`is_default=true`) rows show a disabled
   delete action with a tooltip explaining why.
8. Empty state for zero custom records — the table should still show the default NS/SOA
   rows even when "empty" of user-created records (per Phase 1/3's default-record
   behavior).
9. Same unsaved-changes guard as Phase 7.

### Acceptance criteria (Definition of Done from Phase 7, plus:)
- [ ] Creating one record of every user-creatable type succeeds with correct structured
      validation
- [ ] Invalid input per type shows inline field errors, not a generic failure
- [ ] Type-switch during create resets the form cleanly (no stale fields)
- [ ] Edit never allows changing `type`
- [ ] Default records show disabled delete + tooltip
- [ ] New zones show NS/SOA rows immediately (not an empty table)

---

## Phase 9 — Mocked/Placeholder Sections

**Goal:** Non-core sections exist, are reachable, and are strictly static — no
contradiction with the "Coming Soon" requirement.

### Tasks
1. `components/common/ComingSoon.tsx` — Cloudscape `Container` + empty-state pattern
   (icon, heading, short description). Reused, unmodified in structure, by:
   - `app/(dashboard)/dashboard/page.tsx`
   - `app/(dashboard)/traffic-policies/page.tsx`
   - `app/(dashboard)/health-checks/page.tsx`
   - `app/(dashboard)/resolver/page.tsx`
   - `app/(dashboard)/profiles/page.tsx`

**Explicit correction from v1:** Dashboard is **"Coming Soon" like the other four
sections** — no live counts, no dynamic content. The assignment says a simple
placeholder is sufficient, and mixing "static" and "shows live data" for the same
section created an internal contradiction in the previous plan. If a polished dashboard
with live counts is wanted later, it goes in the Bonus phase as an explicit, separately
justified addition — not baked into core scope.

### Acceptance criteria
- [ ] All 5 placeholder routes (including Dashboard) render the identical static
      "Coming Soon" pattern
- [ ] All 5 are reachable from the sidenav in the confirmed order
- [ ] Zero backend logic exists to support these pages

---

## Phase 10 — UX States, Responsiveness, Accessibility

**Goal:** The "frontend engineering quality" evaluation criterion is addressed directly,
not left implicit.

### Tasks
1. **Loading states** — skeleton loaders on every table (Cloudscape native support).
2. **Responsive behavior**:
   - Desktop: full sidebar
   - Tablet: collapsible sidebar (Cloudscape `AppLayout` supports this natively)
   - Small viewport: tables scroll horizontally rather than breaking layout; side
     panels adapt to viewport width
3. **Accessibility**:
   - Keyboard navigation through nav, tables, forms
   - ARIA labels on icon-only buttons
   - Visible focus states
   - Modal/panel focus trapping; Escape closes; Enter submits the primary form action
     where appropriate
   - All form inputs have associated labels
   (Cloudscape provides most of this by default — verify it isn't broken by
   customizations, don't assume.)
4. **Centralized API error handling** — a single fetch wrapper that parses the error
   contract shape from the API Contract Conventions section and routes it to the
   Flashbar with mapped copy; raw JSON/stack traces must never reach the UI.

### Acceptance criteria
- [ ] Every table shows a skeleton while loading
- [ ] App is usable (no broken layout) at desktop, tablet, and narrow-mobile widths
- [ ] Keyboard-only navigation can reach and operate every core flow (login → create
      zone → create record → delete)
- [ ] No raw error objects/stack traces ever rendered in the UI

---

## Phase 11 — Visual Fidelity Pass (dedicated phase — do not skip)

**Goal:** Directly verify the "look and feel exactly the same" requirement, screen by
screen, against the Phase 0 reference — this is its own phase because the assignment's
strongest wording deserves dedicated verification time, not an assumption that Cloudscape
handled it.

### Tasks
For each screen in `docs/visual-spec.md` (Login, Hosted Zones list, Create Hosted Zone
panel, Zone detail, Create/Edit Record panel, Delete confirmations, Coming Soon,
empty states):
1. Take a screenshot of the implemented screen.
2. Compare side-by-side against the reference.
3. Check off every item in that screen's `docs/visual-spec.md` checklist.
4. Fix any mismatch (spacing, typography, button placement, wording, column widths,
   icon usage) before moving to the next screen.
5. Re-check the whole app's nav consistency (breadcrumbs update correctly on every
   route, sidenav highlights the active section).

### Acceptance criteria
- [ ] Every checklist item in `docs/visual-spec.md` is checked, for every screen
- [ ] Screenshots of clone vs. reference exist for each major screen (store in
      `docs/screenshots/` for the README/demo)
- [ ] No visually "generic CRUD app" screens remain — every screen reads as Route53

---

## Phase 12 — Testing (backend tests written throughout; E2E mandatory here)

**Goal:** Confidence in both unit-level correctness (already built incrementally in
Phases 2–4) and full-flow correctness.

### Tasks
1. Confirm all backend Pytest suites from Phases 2–4 are green (they should already be,
   since tests were written alongside each phase — this is a final full-suite run, not
   the first time tests are written).
2. **Playwright E2E suite (mandatory)** covering:
   - Login → Hosted Zones list loads
   - Create a hosted zone → verify it appears with default NS/SOA records
   - Open zone → create one record of each user-creatable type → verify each appears
   - Search records → verify filtered results
   - Edit a record → verify change persists after refresh
   - Attempt to delete a default record → verify blocked
   - Delete a custom record → verify removed
   - Attempt to delete the zone while a custom record still exists → verify blocked
     (if any remain) or succeeds once all custom records are removed
   - Logout → verify redirected to `/login`
   - Attempt to access `/hosted-zones` directly while logged out → verify redirect
   - Log back in → verify session persistence
   - (If time allows) create a second user, verify they cannot see the first user's zones

### Acceptance criteria
- [ ] All backend tests pass
- [ ] The full Playwright flow above passes end to end
- [ ] Cross-user isolation is verified by an automated test, not just manual inspection

---

## Phase 13 — Documentation

Write `README.md` at the repo root:

1. **Setup instructions** — prerequisites, `docker-compose up` or manual
   `pip install -r requirements.txt` / `npm install`, `.env.example` → `.env` steps,
   how to run the seed script, seeded login credentials.
2. **Architecture overview** — Next.js ↔ FastAPI ↔ SQLite diagram, folder structure,
   why Cloudscape was chosen, and the session-token auth rationale (from the Tech Stack
   section) so a reviewer understands the auth design decision.
3. **Database schema** — from `docs/ERD.md`.
4. **API overview** — endpoint table (method, path, purpose, auth required) + pointer to
   FastAPI's live Swagger docs at `/docs`; keep `docs/api.md` updated incrementally as
   each phase's endpoints are built, not written from scratch at the end.
5. **Bonus features implemented** — list from Phase 14.
6. **Known assumptions** — pointer to `docs/assumptions.md`.

### Acceptance criteria
- [ ] All sections present and accurate
- [ ] A new developer can follow setup instructions from a clean checkout and reach a
      working, seeded app

---

## Phase 14 — Bonus Features (only after Phases 0–13 are fully complete)

Priority order (revised — JSON/BIND export and dark mode are cheap wins; import is the
most expensive and DNS-parsing-adjacent, so it's last among the "real" bonus items):

1. **Export hosted zone as JSON** — `GET /api/hosted-zones/{id}/export?format=json`.
2. **Export as BIND zone file** — text formatter over existing structured records
   (`$ORIGIN`, `$TTL`, one line per record). This re-serializes existing DB rows —
   it is not a DNS engine.
3. **Dark mode** — Cloudscape's built-in `applyMode(Mode.Dark)` theming, toggle in TopNav.
4. **BIND import** — upload → parse against a **deliberately limited grammar** covering
   only A/AAAA/CNAME/TXT/MX/NS/PTR/SRV/CAA → show a preview table → confirm → bulk
   insert via the existing record-create service (reuses Phase 4 validation, does not
   bypass it). Do not attempt a general-purpose BIND parser.
5. **Bulk operations** — multi-select in records table → bulk delete, with: selected
   count shown, confirmation modal, default-record rows excluded from selection,
   partial-failure handling (if one delete fails, report which succeeded/failed rather
   than a silent partial state).
6. **Keyboard shortcuts** — `/` focuses search, `n` opens the create panel, `Escape`
   closes panels/modals.

### Acceptance criteria (per item attempted)
- [ ] Feature works end to end without breaking any Phase 0–13 functionality
- [ ] Feature documented in the README bonus section
- [ ] BIND import/export never introduces real DNS resolution logic

---

## Phase 15 — Deployment & Demo

### Tasks
1. Verify the chosen backend host's **current** persistent-volume support before
   committing to it (don't assume — hosting platform capabilities change; check at
   implementation time). Do not use an ephemeral-filesystem/serverless host for the
   SQLite file.
2. Deploy backend with the volume mounted at the SQLite file's path; set `CORS_ORIGINS`,
   `SESSION_SECRET`, and cookie flags correctly for production (see API Contract
   Conventions).
3. Deploy frontend to Vercel with `NEXT_PUBLIC_API_URL` pointed at the deployed backend.
4. Run the seed script against the deployed backend once, so the live demo starts
   populated (not empty).
5. **Hard acceptance test**: create a hosted zone on the live demo, trigger a
   backend restart/redeploy, confirm the zone still exists afterward. This is the
   concrete proof that "all data must persist in SQLite" holds in the deployed
   environment, not just locally.
6. Final full click-through of the Phase 12 E2E flow against the live URL.

### Acceptance criteria
- [ ] Live demo URL publicly reachable
- [ ] Login works against seeded credentials on the live demo
- [ ] Sample data visible on first load
- [ ] Data survives a backend restart on the deployed host (verified, not assumed)

---

## Priority Tiers (use this if time runs short — never drop a Tier 1 item to add a Tier 3/4 item)

**Tier 1 — absolutely mandatory**
Route53 UI fidelity · Authentication + authorization · Hosted Zone CRUD · DNS Record CRUD
(all 9 user-creatable types) · SQLite persistence (verified on deploy) · Search · Filters
· Pagination · Modals/panels · Notifications

**Tier 2 — required for a polished submission**
Error handling with mapped messages · Loading/empty states · Responsive UI ·
Accessibility basics · Client+server validation · Backend tests · Mandatory E2E test ·
README · Working deployment

**Tier 3 — nice to have**
JSON export · BIND export · Dark mode

**Tier 4 — only if everything above is fully done**
BIND import · Bulk operations · Keyboard shortcuts

---

## Final Spec-Compliance Checklist

- [ ] Mocked login / logout / session persistence, with real per-user authorization
- [ ] Hosted Zones: view, search, create, edit (comment-only), delete — SQLite-persisted,
      scoped per user
- [ ] DNS Records: view, search, create, edit (type immutable), delete for
      A / AAAA / CNAME / TXT / MX / NS / PTR / SRV / CAA — SQLite-persisted
- [ ] Zero real DNS functionality anywhere in the stack
- [ ] Nav structure, tables, forms, search, filters, pagination, modals, notifications —
      all verified against the real Route53 reference in a dedicated visual-fidelity pass
- [ ] Dashboard / Traffic Policies / Health Checks / Resolver / Profiles — all identically
      static "Coming Soon" (no exceptions, no live data)
- [ ] `frontend/` and `backend/` both present in one repo
- [ ] README: setup, architecture, DB schema, API overview, assumptions
- [ ] Live demo link, with persistence proven across a restart
- [ ] Bonus items attempted only after every Tier 1 and Tier 2 item is done
