# Assumptions

# Assumptions

- The supplied screenshots establish console chrome and table density, but do not show every create/edit state. Create and edit actions therefore use Route 53-style right-side panels.
- Delete-zone confirmation requires typing the normalized domain name. Record delete uses a confirmation modal because no record-delete screenshot was supplied.
- Authorization intentionally returns 404 for zones not owned by the user, avoiding resource-existence disclosure.
- The screenshots do not establish a complete current Route 53 navigation taxonomy. The six core routes in the plan are used in this order: Dashboard, Hosted zones, Traffic policies, Health checks, Resolver, Profiles.
- The login screenshot represents AWS sign-in rather than this assignment's mock credentials. The application uses username/password and documents demo credentials in the README.
- No screenshot was supplied for per-type record forms, so structured JSON is a temporary implementation fallback until dedicated form references are available.
