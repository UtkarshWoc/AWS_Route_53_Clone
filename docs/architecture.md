# Architecture

The browser talks to FastAPI with credentialed fetch calls. FastAPI stores only a hash of a cryptographically random opaque session token; the raw token is an HttpOnly cookie. SQLAlchemy enables SQLite foreign keys on every connection, and the Docker configuration places the database on a named volume.

Resource authorization is server-side: list queries filter by `user_id`; nested record routes first load an owned hosted zone; a missing or foreign zone yields 404. The Next.js middleware is explicitly only a no-cookie redirect convenience.
