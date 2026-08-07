# MSP Operations Command Center

A static, first-party-only service-status intelligence workspace for MSP operations. The application is hosted on GitHub Pages at `https://dmo18.github.io/sst/` and requires no backend, database, credentials, paid API, browser-side vendor calls, or unofficial outage data.

Current package version: `3.3.0`.

For the current repository, build, deployment, and production state, see [docs/system-status.md](docs/system-status.md).

## What the system does

The collector reads free public sources owned by the monitored vendors, normalizes them into one validated payload, and publishes a static React application. The interface separates two independent conclusions:

- Service state: operational, degraded, major, or unknown.
- Source health: healthy, watch, or blind, with detailed source-state and evidence fields in the payload.

A source failure never becomes a vendor outage or a green service conclusion. Routine maintenance, resolved history, marketing material, release notes, collector failures, and unreadable-source records are not promoted into the wallboard incident list.

## Current architecture

```text
config/providers.json
  -> bounded first-party retrieval
  -> structured and provider-specific adapters
  -> incident, maintenance, source, and collection intelligence
  -> server validation
  -> public/status.json
  -> browser validation
  -> React/Vite static build
  -> GitHub Pages
```

The catalog contains 80 raw entries and 79 active providers after consolidation. Shared official sources are reused where appropriate. The collection contract is pipeline version `3.0.0` and includes provider coverage, request counts, request latency, quality, evidence, parser identity, source freshness, and blind-spot metrics.

### GitHub platform monitoring

GitHub is monitored as a high-criticality DevOps provider through the official public GitHub Status summary API. The structured source preserves incident lifecycle, timestamps, official links, affected components, and current component states. The monitored service scope explicitly includes:

- Git Operations
- API Requests
- Actions
- GitHub Pages
- Webhooks
- Pull Requests
- Issues

GitHub incidents can appear in Priority signals and Provider Watch like other vendor incidents. Monitoring uses only the public first-party GitHub Status source and requires no repository token, account access, synthetic probing, or browser-side vendor request. A failed GitHub Status retrieval is treated as an observation gap, not as proof of a GitHub outage.

## Operator application

The normal application provides:

- Overview and technician attention queue.
- Incident operations and vendor timelines.
- Provider operations and source reliability.
- Collection evidence, request diagnostics, and bounded history.
- Client-safe draft language that requires technician review.
- Mobile, desktop, ultrawide, 4K, and 8K layouts.

## Wallboard mode

Open wallboard mode with:

```text
https://dmo18.github.io/sst/?view=wallboard
```

The primary compact deployment target is a Yodeck tile that is 458 pixels wide by 291 pixels high. Compact wallboard behavior is designed for a non-interactive heads-up display:

- Priority incidents are sorted by latest vendor update, newest first.
- Provider icons replace numeric row indexes.
- Active provider icons and provider names share the compact top rail.
- The provider rail loops horizontally when it overflows.
- The incident list loops vertically and continuously when it overflows.
- Routine maintenance and collector-health failures are excluded from Priority signals.
- Payload age and browser-check age remain fixed at the right side of the compact top rail.
- Incident rows retain provider name, update age, title, and complete vendor detail text.
- The full header and KPI strip are overlays that can auto-hide, remain pinned open, or remain minimized.
- Header mode is stored in browser local storage.
- React owns incident selection, marquee groups, header state, overlay controls, and freshness telemetry.
- `src/styles/wallboard-v2.css` owns the dedicated wallboard overlay, compact layout, and marquee presentation.
- `src/styles/wallboard-tv.css` applies the 458 by 291 TV-specific readability tuning without changing the incident data model.
- There is no secondary imperative wallboard DOM controller.

### Alert window

Use the `alerts` parameter to limit wallboard incidents by their latest vendor update time:

```text
?view=wallboard&alerts=90m
?view=wallboard&alerts=36h
?view=wallboard&alerts=2d
```

The accepted range is one minute through 30 days. The same filtered incident set drives the vertical incident list and the horizontal provider rail.

### Browser refresh interval

Use the `refresh` parameter to control how often wallboard mode fetches and validates the deployed `status.json` payload while the page is visible:

```text
?view=wallboard&alerts=24h&refresh=30s
?view=wallboard&alerts=24h&refresh=1m
?view=wallboard&alerts=24h&refresh=3m
?view=wallboard&alerts=24h&refresh=5m
```

The accepted range is 15 seconds through one hour using `s`, `m`, or `h`. Missing or invalid values use the three-minute default. This controls the in-app browser payload check only. It does not change GitHub Actions collection cadence and it is separate from Yodeck's optional full-page Refresh Interval setting.

See [docs/wallboard-url-options.md](docs/wallboard-url-options.md) or the [deployed online help](https://dmo18.github.io/sst/help.html).

## Data trust and security

The project intentionally has:

- No secrets in the repository or browser.
- No authentication layer or admin backend.
- No tenant-specific Microsoft Graph access.
- No third-party outage aggregators or crowdsourced incident truth.
- No synthetic availability probes used as vendor health evidence.
- No browser requests to vendor status sources.

All external source collection occurs in GitHub Actions. The browser downloads only static application assets and the deployed `status.json` payload.

## Development commands

Node 22 or newer is required.

```bash
npm ci
npm run validate-providers
npm test
npm run typecheck
npm run build:app
npm run update-status
npm run build
npm audit --audit-level=high
```

`npm test` uses deterministic fixtures and does not contact vendors. `npm run update-status` performs one live first-party collection. Generated payload files are build outputs and must not be committed. `npm run build:app` also generates `public/deploy-version.txt` from the current workflow SHA and run ID before Vite creates the deployment artifact.

## CI and deployment

- `.github/workflows/test.yml` runs pull-request validation, tests, type checking, the application build, and a high-severity dependency audit.
- `.github/workflows/refresh-pages.yml` generates the live payload, validates it, builds the site, uploads one Pages artifact, deploys it, and runs production smoke and browser checks after publication.
- The release path verifies the deployed commit identity and uses Chrome DevTools device metrics to test the wallboard at an actual 458 by 291 CSS viewport.
- `.github/workflows/status-freshness-watch.yml` checks the deployed payload age and dispatches one refresh when the payload is older than 20 minutes and no release is active.

Only the deploy job receives Pages and OIDC write permissions. The build job is read-only. A single Pages concurrency group prevents overlapping releases.

## Documentation

- [Deployed online help](https://dmo18.github.io/sst/help.html)
- [Current system status](docs/system-status.md)
- [Repository architecture report](docs/repository-report.md)
- [Wallboard URL and Yodeck options](docs/wallboard-url-options.md)
- [Open issues and stabilization register](docs/open-issues.md)
- [Contribution requirements](CONTRIBUTING.md)
- [Coding-agent constraints](CLAUDE.md)
- [Release history](CHANGELOG.md)

`docs/2.5.0-release-scope.md` is retained as historical release documentation and is not a description of the current runtime.

## Limitations

Public vendor status pages may omit tenant-, account-, address-, component-, or region-specific effects. Microsoft 365 and Entra ID public sources cannot prove that an individual customer tenant is healthy. An unreachable or unreadable provider source indicates an observation gap, not a vendor outage.
