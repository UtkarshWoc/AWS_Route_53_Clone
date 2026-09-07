# API

The API uses an opaque `route53_session` HttpOnly cookie. Every error is returned as
`{"error":{"code":"...","message":"..."}}`.

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Create a session | No |
| POST | `/api/auth/logout` | Delete current session | Yes |
| GET | `/api/auth/me` | Resolve current user | Yes |
| GET | `/api/hosted-zones` | List owned zones with search, pagination, and sort | Yes |
| POST | `/api/hosted-zones` | Create zone and default NS/SOA records | Yes |
| GET | `/api/hosted-zones/{id}` | Read an owned zone | Yes |
| PUT | `/api/hosted-zones/{id}` | Update comment only | Yes |
| DELETE | `/api/hosted-zones/{id}` | Delete an empty zone | Yes |
| GET | `/api/hosted-zones/{id}/records` | List records with search, type filter, pagination, and sort | Yes |
| POST | `/api/hosted-zones/{id}/records` | Create a validated user record | Yes |
| PUT | `/api/hosted-zones/{id}/records/{recordId}` | Update editable record fields | Yes |
| DELETE | `/api/hosted-zones/{id}/records/{recordId}` | Delete a non-default record | Yes |

## Status and error codes

`401` means no, invalid, or expired session. `404` means the resource does not exist
or belongs to another user. `409` is used for duplicate zones, non-empty zones,
CNAME collisions, and protected default records. `422` is used for request validation.

Known codes include `INVALID_CREDENTIALS`, `SESSION_EXPIRED`, `ZONE_NOT_FOUND`,
`ZONE_NAME_TAKEN`, `HOSTED_ZONE_NOT_EMPTY`, `RECORD_NOT_FOUND`,
`DEFAULT_RECORD_PROTECTED`, `CNAME_COLLISION`, `VALIDATION_ERROR`, and `FORBIDDEN`.
# API

All `/api` hosted-zone and record endpoints require the opaque `route53_session` cookie. Unauthorized or unowned zones return a structured error; unowned zones are deliberately a 404.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Start session |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/hosted-zones` | List/create zones |
| GET/PUT/DELETE | `/api/hosted-zones/{id}` | Read/update/delete zone |
| GET/POST | `/api/hosted-zones/{id}/records` | List/create records |
| PUT/DELETE | `/api/hosted-zones/{id}/records/{recordId}` | Update/delete record |
