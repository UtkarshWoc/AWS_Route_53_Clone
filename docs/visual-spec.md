# Visual specification

This specification is based on the supplied `UI inspos` screenshots. Items marked `[x]` have been checked against the current running app; items marked `[ ]` still require a browser comparison before the phase can be considered complete.

## Shared console chrome
- [x] Dark global header with AWS mark, service title, search affordance, region, and account action.
- [x] Breadcrumb strip is present on core pages.
- [x] Left navigation contains Dashboard, Hosted zones, Traffic policies, Health checks, Resolver, and Profiles.
- [ ] Header spacing and iconography match the reference at desktop width.
- [ ] Sidebar collapse behavior matches the reference at tablet/mobile widths.

## Login
- [x] Full-screen dark background and AWS mark.
- [x] Centered sign-in form with amber primary action.
- [x] Inline invalid-credential error state.
- [ ] Footer links and exact reference spacing verified.
- [x] Mock username/password assumption is documented.

## Hosted zones list
- [x] Page header, zone count, search field, create action, table, and pagination exist.
- [x] Columns include hosted zone name, type, record count, comment, and actions.
- [x] Search and page state persist in the URL.
- [x] Row links navigate to the zone detail page.
- [x] Empty, loading, and error states exist.
- [x] Create/edit side panel exists.
- [x] Delete modal requires typing the normalized domain name.
- [ ] Reference column set and exact wording verified against the supplied screenshot.
- [ ] Refresh/action controls verified against the reference.

## Hosted zone detail and records
- [x] Zone title, record filters, table, and create-record action exist.
- [x] Search, type filter, sort, page size, and pagination persist in the URL.
- [x] Default NS/SOA rows are visible and protected.
- [x] Record edit/delete confirmation flows exist.
- [x] Loading, empty, and error states exist.
- [ ] Exact record column widths and density verified against a reference.

## Create/edit panels
- [x] Hosted-zone create/edit uses a right-side panel.
- [x] Record create/edit uses a right-side panel.
- [x] Dirty forms ask for discard confirmation before closing.
- [ ] Per-record-type field layouts have been visually compared with Route 53.

## Destructive confirmation
- [x] Zone deletion requires typed-name confirmation.
- [x] Record deletion uses a confirmation modal.
- [x] Protected default records do not expose an active delete action.
- [ ] Modal copy, focus behavior, and exact visual treatment verified against a reference.

## Empty and notification states
- [x] Empty hosted-zone and record states have copy and CTAs.
- [x] Loading and error states are rendered without raw exceptions.
- [ ] Shared Flashbar/toast placement and behavior implemented and verified.

## Placeholder pages
- [x] Dashboard, Traffic policies, Health checks, Resolver, and Profiles are reachable.
- [x] All five use the same static Coming Soon component.
- [ ] Placeholder container/icon treatment compared against reference screenshots.
