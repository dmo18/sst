# CLAUDE.md

Guidance for coding agents working on this repository.

## Project goal

Build a free MSP status heads-up display hosted on GitHub Pages and updated by GitHub Actions every 5 minutes.

## Hard constraints

- Do not add Docker.
- Do not add a server runtime.
- Do not use paid APIs.
- Do not require a database.
- Do not require browser-side calls to vendor status pages.
- Keep the app compatible with GitHub Pages static hosting.
- Keep scheduled updates compatible with GitHub Actions free usage.

## Architecture

```text
config/providers.json
  provider definitions and service filters

scripts/fetch-status.js
  GitHub Actions fetcher
  writes status.json

status.json
  generated data file committed by the workflow

index.html
  static HUD
  reads status.json only
```

## UI behavior

The HUD is designed for a fixed wallboard slot, about 458 x 291 pixels.

The browser should show:

- compact provider summary rows
- active incident note queue
- latest note text, not just incident title
- last update timestamp
- history ticker
- provider/source status below the widget

Incident note boxes are generic queue slots. They must not be dedicated to one provider. Sort incidents by provider priority and severity, then show the highest priority items.

## Feed behavior

Status sources vary:

- Statuspage API providers return `status`, `incidents`, `scheduled_maintenances`, and `incident_updates`.
- RSS providers need stale item filtering and deduplication.
- HTML providers should not be treated as rich sources until a custom parser is implemented.
- Limited providers should stay blue and explain why detail is limited.

## Filtering rules

Avoid showing noise:

- old RSS items
- resolved incidents
- completed maintenance
- deprecation announcements
- lifecycle notices
- informational notices
- maintenance with no customer impact

Prefer showing:

- active incidents
- degraded availability
- service disruption
- authentication or email failures
- MSP platform failures
- DNS or networking impact
- security tool outages

## Current known issues to address

- AWS RSS included stale March events. Add max age filtering and deduplication.
- Anthropic showed red even while summary said operational. Fix provider color to green when no active impacting incidents.
- Zoom scheduled/deprecation notices were counted as active incidents. Filter non-impacting maintenance and lifecycle notices.
- Sophos returned HTTP 403 from GitHub Actions. Keep as limited or find a better official source.
- ConnectWise Statuspage API URL returned 404. Replace with the correct official machine-readable feed if available, or keep as public HTML limited.
- Backblaze API path returned HTML instead of JSON. Replace with correct source or limited public HTML.

## Code style

- Plain Node.js, no package dependencies unless there is a strong reason.
- Keep functions small and readable.
- Prefer provider-specific parser helpers over large conditionals as the project grows.
- Always escape text in `index.html` before rendering.
- Do not store secrets in the repo.

## Deployment

GitHub Pages source:

```text
main branch, / root
```

Workflow:

```text
.github/workflows/update-status.yml
```

Manual run path:

```text
Actions -> Update status -> Run workflow -> main
```
