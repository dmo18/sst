# MSP Operations Command Center

A static, first-party-only service-status intelligence workspace for MSP operations. The application is hosted on GitHub Pages at `https://dmo18.github.io/sst/` and requires no backend, database, credentials, paid API, browser-side vendor calls, or unofficial outage data.

Current package version: `3.3.0`.

For the current repository, build, deployment, and production state, see [docs/system-status.md](docs/system-status.md). For the final architecture-overhaul scope and verification record, see [docs/architecture-reconciliation.md](docs/architecture-reconciliation.md).

## What the system does

The collector reads free public sources owned by the monitored vendors, normalizes them into one validated payload, and publishes a static React application. The interface separates independent conclusions:

- Service state: operational, degraded, major, or unknown.
- Source health: healthy, watch, or blind.
- Source observation reliability: rolling seven-day and thirty-day SLO windows.
- Parser trust: stable, changed, observing, or quarantined schema state.

A source failure, parser quarantine, or source SLO breach never becomes a vendor outage or a green service conclusion. Routine maintenance, resolved history, marketing material, release notes, collector failures, and unreadable-source records are not promoted into the wallboard incident list.

## Current architecture

```text
config/providers.json + provider consolidation
  -> canonical active catalog + deterministic catalog hash
  -> bounded first-party retrieval
  -> structured adapters + registry-backed current-page adapter SDK
  -> incident, maintenance, source, reliability, canary, and collection intelligence
  -> internal fail-closed validation
  -> Status Contract v3 envelope + canonical catalog hash
  -> public/status.json
  -> shared browser wire validation
  -> React/Vite static application
  -> GitHub Pages
```

At this revision the catalog contains 80 raw entries and 79 active providers after consolidation. Those counts are descriptive, not hardcoded validation constants; canonical validation derives the active count from catalog contents and exclusions. Shared official sources are reused where appropriate.

The public payload uses Status Contract v3 with `schema_version: 3`, `contract_version: 3`, and a deterministic hash of the canonical active provider catalog. Browser validation, the release contract, and production smoke all require the same catalog identity.

### Source adapters and parser trust

Provider-specific current-page conclusions pass through `scripts/source-adapter-sdk.mjs`. The adapter registry owns normalized result kinds, stable fallback identity, and current-page provenance defaults. The larger provider-specific implementation remains isolated behind that facade instead of being a second public producer contract.

Parser schema canaries are independent from service truth. A first accepted schema-shape change enters observation. Repeated shape churn can quarantine the parser. Observing or quarantined parsers reduce source quality and force source health to `watch`, but they do not change vendor `service_state`, accepted incident severity, component state, or the transport result.

### Source reliability

Every provider publishes bounded seven-day and thirty-day UTC observation windows with live, limited, and unavailable counts plus schema-change counts. Each window reports one of four source SLO states: warming, meeting, watch, or breach. These SLOs describe collector observation reliability only.

See [docs/operations-intelligence.md](docs/operations-intelligence.md) for the complete reliability, canary/quarantine, and correlation contracts.

### GitHub platform monitoring

GitHub is monitored as a high-criticality DevOps provider through the official public GitHub Status summary API. The structured source preserves incident lifecycle, timestamps, official links, affected components, and current component states. The monitored service scope explicitly includes:

- Git Operations
- API Requests
- Actions
- GitHub Pages
- Webhooks
- Pull Requests
- Issues

A failed GitHub Status retrieval is treated as an observation gap, not as proof of a GitHub outage.

## Operator application

The normal application provides:

- Overview and technician attention queue.
- Incident operations and vendor timelines.
- Provider operations and source reliability.
- Seven-day and thirty-day source SLO context.
- Parser canary and quarantine visibility.
- Conservative active-event correlations using vendor-timed incidents only.
- Collection evidence, request diagnostics, and bounded history.
- Client-safe draft language that requires technician review.
- Mobile, desktop, ultrawide, 4K, and 8K layouts.

`src/usePayloadPoller.ts` owns browser retrieval, Status Contract v3/hash validation, the 5 MiB payload limit, request ownership, refresh cadence, hidden-page deferral, visibility-resume recovery, freshness checks, and the timestamp of the most recent successful browser check. `App.tsx` selects operator or wallboard cadence and composes the UI.

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
- Header mode is stored in browser local storage with failure-safe access.
- React owns incident selection, marquee groups, header state, overlay controls, and freshness telemetry.
- `src/styles/wallboard-v2.css` owns the dedicated wallboard overlay, compact layout, and marquee presentation.
- `src/styles/wallboard-tv.css` applies the 458 by 291 TV-specific readability tuning without changing the incident data model.
- There is no secondary imperative wallboard DOM controller.

### Alert window

Use the `alerts` parameter to limit wallboard incidents by their canonical effective incident time:

```text
?view=wallboard&alerts=90m
?view=wallboard&alerts=36h
?view=wallboard&alerts=2d
```

The accepted range is one minute through 30 days. Vendor-timed incidents use official timing. Untimed accepted current-page evidence can use its fresh `observed_at` snapshot time only when `evidence_basis=current-page`. The same filtered incident set drives the vertical incident list and horizontal provider rail.

### Browser refresh interval

Use the `refresh` parameter to control how often wallboard mode fetches and validates the deployed `status.json` payload while the page is visible:

```text
?view=wallboard&alerts=24h&refresh=30s
?view=wallboard&alerts=24h&refresh=1m
?view=wallboard&alerts=24h&refresh=3m
?view=wallboard&alerts=24h&refresh=5m
```

The accepted range is 15 seconds through one hour using `s`, `m`, or `h`. Missing or invalid values use the three-minute default. Operator mode uses a 60-second browser check. These settings affect in-browser payload retrieval only. They do not change GitHub Actions vendor collection cadence and are separate from Yodeck's optional full-page Refresh Interval setting.

See [docs/wallboard-url-options.md](docs/wallboard-url-options.md) or the [deployed online help](https://dmo18.github.io/sst/help.html).

## Data trust and security

The project intentionally has:

- No secrets in the repository or browser.
- No authentication layer or admin backend.
- No customer, tenant, ticket, device, or user-specific data in the public Pages application.
- No tenant-specific Microsoft Graph access.
- No third-party outage aggregators or crowdsourced incident truth.
- No synthetic availability probes used as vendor-health evidence.
- No browser requests to vendor status sources.
- A restrictive production CSP for local application code and same-origin data retrieval.

All external source collection occurs in GitHub Actions. Live vendor collection runs with GitHub tokens removed from the process environment. Vendor pages rendered during collection use sandboxed Chromium with disposable profiles. The browser downloads only static application assets and the deployed `status.json` payload.

## Development commands

Node 22 or newer is required.

```bash
npm ci
npm run validate-providers
npm run quality
npm test
npm run typecheck
npm run build:app
npm run update-status
npm audit --audit-level=high
```

After cloning, contributors who want the repository-owned pre-commit quality hook can opt in once with:

```bash
npm run hooks:install
```

`npm run quality` runs dependency-free source lint/policy checks and formatting hygiene. The hook runs the same command. Installation is explicit so `npm ci` never mutates a developer's Git configuration.

`npm test` uses deterministic fixtures and does not contact vendors. `npm run update-status` performs one live first-party collection, internally validates the collector draft, then emits and validates the public Status Contract v3 envelope. Generated payload files are build outputs and must not be committed.

## CI and deployment

- `.github/workflows/test.yml` runs pull-request provider validation, repository quality gates, all deterministic tests, TypeScript, the application build, and complete high-severity dependency audit.
- `.github/workflows/codeql.yml` runs pinned CodeQL v4 JavaScript/TypeScript analysis on pull requests, `main`, and a weekly schedule.
- `.github/workflows/refresh-pages.yml` performs serialized live collection, Status Contract v3/hash validation, deployment, production smoke, current-browser rendering, and exact Yodeck verification.
- Code-changing push/manual releases also run quality, tests, TypeScript, audit, build the Chrome-98-compatible application shell, publish that verified shell as a commit-keyed artifact, and execute a pinned pre-cascade-layer Chromium compatibility probe.
- Scheduled live-data refreshes reuse the verified application shell for the same commit. They skip unchanged quality/test/type/audit/compile work but still collect and validate live vendor data, deploy, smoke test, render, verify exact Yodeck geometry, and publish live-coverage status. If the shell artifact is unavailable, the schedule performs a fail-safe application build rather than sacrificing freshness.
- `.github/workflows/status-freshness-watch.yml` checks deployed payload age and dispatches one refresh when the payload is older than 20 minutes and no release is active.

Only the deploy job receives Pages/OIDC/status write permissions. The collection/build job is read-only apart from reading its own verified shell artifacts. A single Pages concurrency group prevents overlapping releases.

## Documentation

- [Full architecture reconciliation](docs/architecture-reconciliation.md)
- [Operations intelligence contracts](docs/operations-intelligence.md)
- [Deployed online help](https://dmo18.github.io/sst/help.html)
- [Current system status](docs/system-status.md)
- [Repository architecture report](docs/repository-report.md)
- [Wallboard URL and Yodeck options](docs/wallboard-url-options.md)
- [Open issues and stabilization register](docs/open-issues.md)
- [Contribution requirements](CONTRIBUTING.md)
- [Coding-agent constraints](CLAUDE.md)
- [Release history](CHANGELOG.md)
- [Historical first-pass architecture record](docs/architecture-overhaul.md)

`docs/2.5.0-release-scope.md` and the first-pass architecture-overhaul record are retained as historical documentation and are not descriptions of the final reconciled architecture.

## Limitations

Public vendor status pages may omit tenant-, account-, address-, component-, or region-specific effects. Microsoft 365 and Entra ID public sources cannot prove that an individual customer tenant is healthy. An unreachable or unreadable provider source indicates an observation gap, not a vendor outage. Source SLOs, parser quarantine, and event correlation are operational evidence controls, not replacements for vendor truth.
