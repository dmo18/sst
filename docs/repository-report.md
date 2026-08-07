# Repository architecture report

## Product and trust model

This repository builds a static MSP operations command center from free public sources owned by the monitored vendors. The active catalog contains 78 providers after consolidation from 79 raw entries. Collection pipeline version `3.0.0` separates service state from source health and publishes provider, request, evidence, freshness, parser, quality, and blind-spot metrics.

The system fails closed:

- A source failure is not a vendor outage.
- A readable but limited source is not operational confirmation.
- Missing data cannot produce a green conclusion.
- Routine maintenance, resolved history, marketing posts, release notes, generic headings, and collector errors do not become active incidents.
- Browser code validates the payload independently before presenting it.

Retrieval is bounded by global and per-origin concurrency, timeouts, streamed response-size limits, parser-specific content types, and one transient retry. Parser, schema, size, and content-type failures are not retried as incidents. Writes are atomic and generated status payloads are build outputs.

## Repository map

### Runtime application

- `src/App.tsx`: data lifecycle, payload refresh, browser-check timestamp, route selection, and operator or wallboard rendering.
- `src/IssueConsole.tsx`: operator workspace.
- `src/WallboardV2.tsx`: sole active wallboard implementation, including overlay state, freshness telemetry, alert filtering, and marquee ownership.
- `src/wallboardRoute.ts`: wallboard mode and `alerts` duration parsing.
- `src/statusViewModel.ts`: command-center and action-queue model.
- `src/payloadValidation.ts`: browser payload validation.
- `src/types.ts`: payload and UI contracts.
- `src/styles/wallboard-v2.css`: dedicated wallboard overlay, compact geometry, provider rail, incident list, and marquee presentation.
- `src/styles/command-center.css`: shared application tokens and generic base primitives used by operator and wallboard surfaces.

The legacy `src/Wallboard.tsx`, `src/wallboard.ts`, `src/wallboardDomEnhancements.ts`, `src/styles/wallboard-focus.css`, and the legacy wallboard test have been removed. There is one wallboard implementation and one dedicated wallboard stylesheet.

### Collection and normalization

- `config/providers.json`: raw provider catalog.
- `config/provider-consolidation.json`: active catalog exclusions and overrides.
- `scripts/update-status.mjs`: collection orchestration.
- `scripts/update-public-status.mjs`: public-source collection and normalization.
- `scripts/structured-source-adapters.mjs`: structured platform and provider adapters.
- `scripts/public-source-repairs.mjs`: provider-specific source handling.
- `scripts/incident-detail-repairs.mjs`: bounded incident detail cleanup.
- `scripts/incident-freshness.mjs`: current-evidence policy.
- `scripts/source-intelligence.mjs`: source evidence and reliability history.
- `scripts/collection-intelligence.mjs`: request and run metrics.
- `scripts/ensure-valid-status.mjs`: server-side payload validation and safe fallback behavior.

### Validation and tests

- `scripts/__tests__/`: collector, parser, maintenance, freshness, workflow, visual, and payload tests.
- `src/__tests__/`: lifecycle, view-model, telemetry, icons, wallboard route, and browser validation tests.
- `scripts/production-smoke.mjs`: deployed asset, payload, and release-identity verification.
- `scripts/verify-yodeck-wallboard.mjs`: Chrome DevTools Protocol verification at an exact 458 by 291 CSS viewport, including DOM and screenshot evidence.
- `scripts/write-deploy-version.mjs`: generated deployment identity from `GITHUB_SHA` and `GITHUB_RUN_ID`.
- `scripts/validate-browser-payload.mjs`: browser contract validation outside the browser.
- `scripts/validate-providers.mjs`: catalog and metadata validation.

The deterministic suite includes structural contracts that prevent the removed imperative wallboard controller, split wallboard stylesheet, legacy wallboard component, and checked-in deployment marker from returning.

### Automation

- `.github/workflows/test.yml`: pull-request validation without live vendor retrieval.
- `.github/workflows/refresh-pages.yml`: scheduled, push, and manual status generation plus Pages deployment and post-deploy verification.
- `.github/workflows/status-freshness-watch.yml`: deployed-payload age check and bounded recovery dispatch that defers while a release is active.

The Pages release path uses one `pages-release` concurrency group with in-progress cancellation disabled. Every release event runs tests, type checking, dependency audit, live collection, payload validation, build, Pages publication, production smoke, normal browser rendering, and exact Yodeck verification.

## Runtime behavior

The browser requests only static assets and `status.json`. It refreshes the payload once per minute while visible. A payload older than 20 minutes produces a freshness warning. Browser check and payload ages are maintained in React state and rendered directly into the wallboard without a DOM enhancement module.

The operator application exposes incidents, provider diagnostics, source reliability, request evidence, maintenance intelligence, timeline history, and cautious communication drafts.

The active wallboard presents newest-first vendor incidents and a provider watch. In compact mode it prioritizes one fixed heading, one horizontally looping provider rail, and one vertically looping incident list. Maintenance and collector failures are excluded from Priority signals. The target non-interactive Yodeck region is 458 by 291 pixels.

## Wallboard ownership contract

React owns:

- incident filtering and ordering;
- provider deduplication;
- duplicate groups for seamless loops;
- header mode and local-storage persistence;
- overlay control rendering;
- payload and browser freshness telemetry;
- the Yodeck layout-probe state.

`wallboard-v2.css` owns wallboard-specific geometry, overlay presentation, compact breakpoints, and marquee animation. Shared application design tokens and generic base wallboard primitives may remain in `command-center.css`.

The runtime must not add a MutationObserver, query and replace rendered signal articles, clone live DOM nodes, inject runtime styles, or load a second wallboard controller.

## Deployment identity

`public/deploy-version.txt` is no longer a checked-in marker. `scripts/write-deploy-version.mjs` generates it during `npm run build:app` with:

- the workflow commit from `GITHUB_SHA`;
- the workflow run ID from `GITHUB_RUN_ID`;
- an ISO generation timestamp.

`production-smoke.mjs` retrieves the deployed marker and rejects a release when the deployed commit or run ID differs from the workflow being verified. This separates "artifact built" from "the intended revision is actually live".

## Security posture

- No credentials or secrets are stored in the repository or browser.
- No server runtime or database exists.
- No authenticated tenant APIs are used.
- No commercial status aggregation service is a runtime dependency.
- No crowdsourced outage data is treated as operational truth.
- No browser-side vendor collection occurs.
- Build permissions are read-only.
- Pages and OIDC write permissions are restricted to the deploy job.

## Current operational state

GitHub Actions and Pages recovered from the 2026-08-06 platform incident. Controlled production workflow run `31137204360` successfully deployed commit `428b231f454a9df65687da51b0c4b3aeb6eb2545` and passed the complete build, production smoke, normal headless browser, exact 458 by 291 Yodeck, artifact-upload, and deployment-status path.

The remaining Step 1 evidence is two consecutive successful scheduled releases without freshness-watch interference. The Step 2 architectural cleanup described above is implemented on its isolated branch and must pass PR checks and the same production release gate before it is considered live. See [system-status.md](system-status.md) and [open-issues.md](open-issues.md).
