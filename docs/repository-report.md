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

- `src/App.tsx`: data lifecycle, payload refresh, route selection, and operator or wallboard rendering.
- `src/IssueConsole.tsx`: operator workspace.
- `src/WallboardV2.tsx`: active wallboard implementation.
- `src/wallboardRoute.ts`: wallboard mode and `alerts` duration parsing.
- `src/wallboardDomEnhancements.ts`: bounded overlay state and inline freshness telemetry.
- `src/statusViewModel.ts`: command-center and action-queue model.
- `src/payloadValidation.ts`: browser payload validation.
- `src/types.ts`: payload and UI contracts.
- `src/styles/`: application, mobile, ultra-HD, wallboard overlay, and compact wallboard styles.

`src/Wallboard.tsx` remains as legacy code but is not selected by `App.tsx`.

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
- `scripts/production-smoke.mjs`: deployed asset and payload verification.
- `scripts/validate-browser-payload.mjs`: browser contract validation outside the browser.
- `scripts/validate-providers.mjs`: catalog and metadata validation.

The current suite contains 139 deterministic tests.

### Automation

- `.github/workflows/test.yml`: pull-request validation without live vendor retrieval.
- `.github/workflows/refresh-pages.yml`: scheduled, push, and manual status generation plus Pages deployment.
- `.github/workflows/status-freshness-watch.yml`: deployed-payload age check and bounded recovery dispatch.

## Runtime behavior

The browser requests only static assets and `status.json`. It refreshes the payload once per minute while visible. A payload older than 20 minutes produces a freshness warning. Browser check and payload ages are continuously updated without implying streaming vendor data.

The operator application exposes incidents, provider diagnostics, source reliability, request evidence, maintenance intelligence, timeline history, and cautious communication drafts.

The active wallboard presents newest-first vendor incidents and a provider watch. In compact mode it prioritizes one fixed heading, one horizontally looping provider rail, and one vertically looping incident list. Maintenance and collector failures are excluded from Priority signals. The target non-interactive Yodeck region is 458 by 291 pixels.

## Wallboard ownership contract

React owns incident ordering, provider deduplication, list duplication for seamless loops, and alert-window filtering. CSS owns marquee movement and compact geometry. `wallboardDomEnhancements.ts` may only control overlay visibility and freshness telemetry.

The enhancement module must not:

- use a MutationObserver;
- query and replace incident articles;
- reorder signal rows;
- hide incident rows;
- clone live rendered rows;
- inject competing wallboard styles.

## Security posture

- No credentials or secrets are stored in the repository or browser.
- No server runtime or database exists.
- No authenticated tenant APIs are used.
- No commercial status aggregation service is a runtime dependency.
- No crowdsourced outage data is treated as operational truth.
- No browser-side vendor collection occurs.
- Build permissions are read-only.
- Pages and OIDC write permissions are restricted to the deploy job.

## Current operational caveat

The source tree at main builds and validates successfully, but the latest Pages deploy failed inside `actions/deploy-pages@v4`. The last confirmed production release is commit `9f7702b708ad57597221678751b5cf0f59eaf787`. See [system-status.md](system-status.md) for the current release state and known risks.