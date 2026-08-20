# MSP Operations Command Center

A static, first-party-only service-status intelligence workspace for MSP operations. The application is hosted on GitHub Pages at `https://dmo18.github.io/sst/` and requires no backend, database, credentials, paid API, browser-side vendor calls, runtime logo CDN, or unofficial outage data.

Current package version: `3.3.3`.

For the current repository, build, deployment, and production state, see [docs/system-status.md](docs/system-status.md). For the completed product-depth scope and evidence, see [docs/product-depth-command-system.md](docs/product-depth-command-system.md). For the architecture-overhaul scope and verification record, see [docs/architecture-reconciliation.md](docs/architecture-reconciliation.md).

## What the system does

The collector reads free public sources owned by monitored vendors, normalizes them into one validated payload, and publishes a static React application. The interface separates independent conclusions:

- Service state: operational, degraded, major, or unknown.
- Source health: healthy, watch, or blind.
- Source observation reliability: rolling seven-day and thirty-day SLO windows.
- Parser trust: stable, changed, observing, or quarantined schema state.
- Browser-local operator workflow: acknowledgement, follow, snooze, handled state, notes, assignee, pins, and lenses that never rewrite vendor truth.

A source failure, parser quarantine, or source SLO breach never becomes a vendor outage or a green service conclusion. Routine maintenance, resolved history, marketing material, release notes, collector failures, and unreadable-source records are not promoted into the wallboard incident list. Temporal correlations remain non-causal.

## Current architecture

```text
config/providers.json + provider consolidation
  -> 80-provider canonical active catalog + deterministic catalog hash
  -> bounded first-party retrieval
  -> structured adapters + registry-backed current-page adapter SDK
  -> incident, maintenance, source, reliability, canary, and collection intelligence
  -> internal fail-closed validation
  -> Status Contract v3 envelope + canonical catalog hash
  -> public/status.json
  -> shared browser wire validation
  -> usePayloadPoller
  -> premium operator command center / product-depth layer / wallboard
  -> GitHub Pages
```

At this revision the catalog contains 80 raw entries and 80 active canonical providers across 31 categories. Those counts are descriptive, not hardcoded validation constants; canonical validation derives membership from the catalog and consolidation rules. Shared official sources are reused where appropriate.

The public payload uses Status Contract v3 with `schema_version: 3`, `contract_version: 3`, and a deterministic hash of the canonical active provider catalog. Browser validation, the release contract, and production smoke all require the same catalog identity.

### Source adapters and parser trust

Provider-specific current-page conclusions pass through `scripts/source-adapter-sdk.mjs`. The adapter registry owns normalized result kinds, stable fallback identity, and current-page provenance defaults. The larger provider-specific implementation remains isolated behind that facade instead of becoming a second public producer contract.

Parser schema canaries are independent from service truth. A first accepted schema-shape change enters observation. Repeated shape churn can quarantine the parser. Observing or quarantined parsers reduce source quality and force source health to `watch`, but they do not change vendor `service_state`, accepted incident severity, component state, or transport result.

### Source reliability

Every provider publishes bounded seven-day and thirty-day UTC observation windows with live, limited, and unavailable counts plus schema-change counts. Each window reports one of four source SLO states: warming, meeting, watch, or breach. These SLOs describe collector observation reliability only.

See [docs/operations-intelligence.md](docs/operations-intelligence.md) for the complete reliability, canary/quarantine, and correlation contracts.

## Operator application

The normal application provides:

- State-aware operating posture and technician attention queue.
- Incident Focus with vendor timeline, evidence, technician guidance, client-safe draft, local workflow actions, handoff, and shareable deep link.
- Dependency Universe with category/provider topology and cautious temporal-correlation edges.
- Signal Replay from bounded recorded changes only; it does not reconstruct unobserved historical service state.
- Command/Ctrl + K command palette and Command/Ctrl + Shift + K universal search.
- Since-last-review catch-up intelligence.
- Browser-local provider pins and saved lenses.
- Provider operations, source reliability, seven-day and thirty-day SLOs, parser canary/quarantine, collection evidence, and bounded history.
- Premium desktop and dedicated 390x844 mobile layouts.

`src/usePayloadPoller.ts` owns browser retrieval, Status Contract v3/hash validation, the 5 MiB payload limit, request ownership, refresh cadence, hidden-page deferral, visibility-resume recovery, freshness checks, and the timestamp of the most recent successful browser check. `App.tsx` selects operator or wallboard cadence and composes the UI.

### Microsoft 365 critical coverage

Microsoft 365 is treated as a critical operating suite rather than a generic provider row. The product represents ten service facets covering the major Microsoft cloud operating surface, including Exchange Online, Microsoft Teams, SharePoint Online, OneDrive, Microsoft Entra ID, Microsoft 365 administration/service-health context, and related collaboration/identity dependencies.

The evidence boundary is explicit:

- broad public Microsoft status is public evidence;
- Entra receives dedicated public-source evidence where available;
- tenant-complete Microsoft 365 service health requires authenticated Microsoft Graph service communications with `ServiceHealth.Read.All`.

The public static application does not claim tenant-specific Microsoft 365 health that Microsoft exposes only through authenticated tenant context.

### NUSO

NUSO is a first-class high-criticality VoIP/communications provider using the public NUSO Statuspage feed at `https://status.nuso.cloud/api/v2/summary.json`.

Its canonical scope includes UCaaS, NUSO Bridge for Teams, NUSO Bridge for Zoom, Microsoft Operator Connect, inbound/outbound voice, messaging/SMS/MMS, emergency services, network, portals, and CPaaS/API surfaces. It participates in the same catalog hash, live collection, Status Contract validation, search, Dependency Universe, provider operations, release, and deployed evidence paths as other canonical providers.

### Provider recognition

Every active provider has a curated local recognition identity so operators can scan the estate visually before reading labels.

The production contract currently has:

- 80/80 active providers with curated identities;
- 45 local exact/brand-geometry provider references across 43 unique bundled exact assets;
- 35 exact masked marks in the deployed provider table;
- 35 provider-specific embedded SVG recognition aids for vendors without a stable exact mark in the pinned source set;
- deterministic initials only as the fallback for an unknown provider outside the canonical catalog;
- zero runtime logo CDN, favicon, or external-logo requests.

Exact sourced geometry and provider-specific recognition aids are deliberately distinguished. Long-tail recognition tiles use curated labels, brand-family colors, and motifs but are not represented as official vendor artwork. Source and licensing notes are recorded in `public/assets/logos/BRAND-SOURCES.md`.

### GitHub platform monitoring

GitHub is monitored as a high-criticality DevOps provider through the official public GitHub Status summary API. The structured source preserves incident lifecycle, timestamps, official links, affected components, and current component states. Monitored scope includes Git Operations, API Requests, Actions, GitHub Pages, Webhooks, Pull Requests, and Issues.

A failed GitHub Status retrieval is treated as an observation gap, not proof of a GitHub outage.

## Wallboard mode

Open wallboard mode with:

```text
https://dmo18.github.io/sst/?view=wallboard
```

The primary compact deployment target is a Yodeck tile 458 pixels wide by 291 pixels high. Compact wallboard behavior is designed for a non-interactive heads-up display:

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
- The product-depth and provider-identity layers load before authoritative wallboard geometry and do not mount operator command surfaces in wallboard mode.
- `src/styles/wallboard-v2.css`, `wallboard-compat.css`, `wallboard-tv.css`, and `wallboard-premium.css` retain final signage ownership.

### Alert window

Use the `alerts` parameter to limit wallboard incidents by canonical effective incident time:

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
- No tenant-specific Microsoft Graph ingestion in the public Pages application.
- No third-party outage aggregators or crowdsourced incident truth.
- No synthetic availability probes used as vendor-health evidence.
- No browser requests to vendor status sources.
- No runtime external provider-logo requests.
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
- `.github/workflows/refresh-pages.yml` performs serialized live collection, Status Contract v3/hash validation, deployment, production smoke, current-browser rendering, pinned pre-Cascade-Layers Chromium verification, and exact Yodeck verification.
- Code-changing push/manual releases also run quality, tests, TypeScript, audit, build the Chrome-98-compatible application shell, and publish that verified shell as a commit-keyed artifact.
- Scheduled live-data refreshes reuse the verified application shell for the same commit. They skip unchanged quality/test/type/audit/compile work but still collect and validate live vendor data, deploy, smoke test, render, verify exact Yodeck geometry, and publish live-coverage status. If the shell artifact is unavailable, the schedule performs a fail-safe application build rather than sacrificing freshness.
- `.github/workflows/product-experience.yml` runs after successful non-scheduled releases and browser-verifies premium desktop/command/mobile, Dependency Universe/search/Incident Focus, Microsoft 365 critical coverage, and provider identity/NUSO desktop/mobile evidence. It retains screenshots and verifier logs for human review.
- `.github/workflows/status-freshness-watch.yml` checks deployed payload age and dispatches one refresh when the payload is older than 20 minutes and no release is active.

Only the deploy job receives Pages/OIDC/status write permissions. The collection/build job is read-only apart from reading its own verified shell artifacts. A single Pages concurrency group prevents overlapping releases.

## Current acceptance evidence

The final product implementation commit is `357021b38a955b402af03d35415d1c1eae2a1550`.

Production release #833 (`31539557831`) passed the full repository, fresh live collection including NUSO, Status Contract validation, deployment, current Chromium, pinned pre-Cascade-Layers Chromium, exact 458x291 Yodeck, artifacts, and deployed-intelligence path. Main CodeQL #125 (`31539557679`) passed on the same commit.

Product-experience run #34 (`31539671901`) passed every deployed product gate and uploaded evidence artifact `9120182392`. Its provider contract recorded 80 providers, 35 exact masks, 35 curated embedded identities, 45 local exact-logo references, 43 unique exact assets, no external logo loading, and NUSO intentionally visible in the mobile evidence frame.

## Documentation

- [Full architecture reconciliation](docs/architecture-reconciliation.md)
- [Product-depth command system and completion evidence](docs/product-depth-command-system.md)
- [Premium product experience overhaul](docs/product-experience-overhaul.md)
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

Public vendor status pages may omit tenant-, account-, address-, component-, or region-specific effects. Microsoft 365 and Entra ID public sources cannot prove that an individual customer tenant is healthy; tenant-complete Microsoft service health requires authenticated Microsoft Graph context. An unreachable or unreadable provider source indicates an observation gap, not a vendor outage. Source SLOs, parser quarantine, local operator actions, and temporal correlation are operational evidence/workflow controls, not replacements for vendor truth.
