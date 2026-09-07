# AWS Route 53 Clone

A Route 53 console-inspired CRUD application for DNS configuration data. It does not
## Setup

Prerequisites: Python 3.11+, Node.js 20+, and SQLite support.

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
Set-Location backend
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open `http://localhost:3000` and sign in with `demo` / `demo1234`.

Docker Compose is also supported:

```powershell
docker compose up --build
```

The `route53_data` named volume stores the SQLite database at `/data/app.db`.

## Architecture

```text
Next.js 14 App Router -> FastAPI -> SQLAlchemy -> SQLite
                              |
                              +-- opaque HttpOnly session cookie
```

The browser middleware only checks cookie presence to avoid a protected-page flash.
FastAPI validates the opaque token and ownership on every protected request. Tokens are
cryptographically random; only their SHA-256 hashes are stored in the database.

The frontend uses native fetch and a shared notification context. The backend owns all
normalization, authorization, record validation, and destructive-operation rules.

## Data model

Users own sessions and hosted zones. Hosted zones own DNS records. New zones receive
protected NS and SOA records. Zone record counts are computed at read time. The full
schema is documented in [docs/ERD.md](docs/ERD.md).

## API

The live interactive API documentation is available at `http://localhost:8000/docs`.
Endpoint details and the error contract are in [docs/api.md](docs/api.md).

All protected endpoints require the `route53_session` cookie. Foreign zones return 404
to avoid leaking whether another user's resource exists. Errors use:

```json
{"error":{"code":"ZONE_NOT_FOUND","message":"Hosted zone was not found."}}
```

## Testing

```powershell
Set-Location backend
python -m pytest -q

Set-Location ../frontend
npm run build
npm run test:e2e
```

The E2E test expects the backend and frontend to be running. Set `E2E_BASE_URL` when
the frontend is not on port 3000.

## Bonus features

- `GET /api/hosted-zones/{id}/export?format=json` exports stored zone and record data.
- `GET /api/hosted-zones/{id}/export?format=bind` formats stored records as a limited
    BIND-style zone file. Neither export performs DNS resolution.

## Project layout

- `frontend/` - Next.js UI, route shell, forms, notifications, and Playwright tests
- `backend/` - FastAPI API, SQLAlchemy models, Alembic migration, seed script
- `docs/` - architecture, ERD, API, visual specification, assumptions, screenshots

## Scope and assumptions

Visual choices and unavailable reference details are documented in
[docs/assumptions.md](docs/assumptions.md). Features outside DNS configuration CRUD,
mock authentication, authorization, and Route 53-style UI are intentionally out of
scope.
# AWS Route 53 Clone

A Route 53 console-inspired CRUD application with a Next.js frontend, FastAPI API, and persistent SQLite database. It intentionally models DNS configuration data only: it does not resolve DNS, delegate nameservers, or call AWS.

## Quick start

1. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local` if you need non-default values.
2. In `backend`, create a virtual environment, install `requirements.txt`, run `python -m app.seed`, then `uvicorn app.main:app --reload`.
3. In `frontend`, run `npm install` then `npm run dev`.
4. Open `http://localhost:3000` and sign in using **demo** / **demo1234**.

Alternatively run `docker compose up`; the named `route53_data` volume persists SQLite data.

## Architecture

```text
Next.js 14 UI  →  FastAPI API  →  SQLAlchemy  →  SQLite named volume
                    │
                    └── opaque HttpOnly session cookie
```

The frontend middleware checks cookie presence only to prevent a protected-page flash. FastAPI validates every session and scopes every hosted zone to its owner, so guessed IDs never disclose another user’s data. API documentation is available at `http://localhost:8000/docs`; endpoint details are in [docs/api.md](docs/api.md).

## Data model and behavior

Users own hosted zones; zones own DNS records. Newly created zones receive protected NS and SOA default records. Hosted-zone names are normalized; only comments may be edited. DNS record types A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, and CAA have type-aware server validation; records cannot change type, and CNAME collisions are prevented. See [docs/ERD.md](docs/ERD.md).

## Project layout

- `frontend/` — Next.js UI and reference-informed AWS console layout
- `backend/` — FastAPI API, SQLite models, auth, validation, seed script
- `docs/` — API, ERD, visual specification, and documented assumptions

## Assumptions

Visual choices were derived only from the provided `UI inspos` screenshots. See [docs/assumptions.md](docs/assumptions.md).
