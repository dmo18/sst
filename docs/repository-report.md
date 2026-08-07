# Repository architecture report

## Product and trust model

This repository builds a static MSP operations command center from free public sources owned by monitored vendors. The production catalog contains 79 active providers after consolidation from 80 raw entries, including GitHub through the official GitHub Status source.

Collection pipeline version `3.0.0` separates service state from source health and publishes provider, request, evidence, freshness, parser, quality, and blind-spot metrics.

The system fails closed:

- A source failure is not a vendor outage.
- A readable but limited source is not operational confirmation.
- Missing data cannot produce a green conclusion.
- Routine maintenance, resolved history, marketing posts, release notes, generic headings, and collector errors do not become active incidents.
- Browser code validates the payload independently before presenting it.

Retrieval is bounded by global and per-origin concurrency, timeouts, streamed response-size limits, parser-specific content types, and one transient retry. Parser, schema, size, and content-type failures are not retried as incidents. Writes are atomic and generated status payloads are build outputs.

## Repository map

### Runtime application

- `src/App.tsx`: data lifecycle, payload refresh, browser-check timestamp, route selection, URL-controlled wallboard refresh interval ownership, and operator or wallboard rendering.
- `src/IssueConsole.tsx`: operator workspace.
- `src/WallboardV2.tsx`: sole active wallboard implementation, including overlay state, freshness telemetry, alert filtering, and marquee ownership.
- `src/wallboardRoute.ts`: wallboard mode, `alerts` duration parsing, bounded `refresh` duration parsing, and route state.
- `src/statusViewModel.ts`: command-center and action-queue model.
- `src/payloadValidation.ts`: browser payload validation.
- `src/types.ts`: payload and UI contracts.
- `src/main.tsx`: application entrypoint plus the legacy signage capability check that adds `no-css-layers` only when `CSSLayerBlockRule` is unavailable.
- `src/styles/wallboard-v2.css`: dedicated modern-browser wallboard overlay, compact geometry, provider rail, incident list, and marquee presentation.
- `src/styles/wallboard-compat.css`: unlayered structural fallback for signage browsers that do not support CSS Cascade Layers. Every selector is gated by `html.no-css-layers`.
- `src/styles/wallboard-tv.css`: compact 458 by 291 TV-specific spacing, typography, provider-rail, and incident-card tuning applied after both wallboard presentation paths.
- `src/styles/command-center.css`: shared application tokens and generic base primitives used by operator and wallboard surfaces.
- `public/help.html`: static deployed wallboard and Yodeck help page copied into the GitHub Pages artifact by Vite.

The legacy `src/Wallboard.tsx`, `src/wallboard.ts`, `src/wallboardDomEnhancements.ts`, `src/styles/wallboard-focus.css`, and the legacy wallboard test have been removed. There is one React wallboard implementation. The compatibility and TV stylesheets are not second wallboard implementations or controllers. They only provide browser compatibility and compact presentation rules around the same React tree.

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

- `scripts/__tests__/`: collector, parser, maintenance, freshness, workflow, visual, compatibility, payload, compact-TV, refresh, and help tests.
- `src/__tests__/`: lifecycle, view-model, telemetry, icons, wallboard route, and browser validation tests.
- `src/__tests__/wallboardRoute.test.ts`: deterministic alert-window and browser-refresh URL parsing tests, including bounds and safe fallback behavior.
- `scripts/__tests__/wallboard-compatibility.test.js`: contract that requires the legacy signage fallback to remain unlayered, marker-scoped, and structurally complete for compact wallboard use.
- `scripts/__tests__/wallboard-tv-detail.test.js`: compact 458 by 291 presentation contract that preserves full incident text, provider names, telemetry, and icon-to-text spacing.
- `scripts/__tests__/wallboard-refresh-help.test.js`: contract for wallboard-only refresh ownership, safe interval bounds, deployed help content, and no-script help delivery.
- `scripts/production-smoke.mjs`: deployed asset, payload, and release-identity verification.
- `scripts/verify-yodeck-wallboard.mjs`: Chrome DevTools Protocol verification at an exact 458 by 291 CSS viewport, including DOM and screenshot evidence.
- `scripts/write-deploy-version.mjs`: generated deployment identity from `GITHUB_SHA` and `GITHUB_RUN_ID`.
- `scripts/validate-browser-payload.mjs`: browser contract validation outside the browser.
- `scripts/validate-providers.mjs`: catalog and metadata validation.

The deterministic suite includes structural contracts that prevent the removed imperative wallboard controller, legacy wallboard component, and checked-in deployment marker from returning. It also verifies that the compatibility fallback cannot affect modern browsers unless the `no-css-layers` marker is present, that compact TV presentation does not hide incident detail, and that browser-refresh URL values remain bounded.

### Automation

- `.github/workflows/test.yml`: pull-request validation without live vendor retrieval.
- `.github/workflows/refresh-pages.yml`: scheduled, push, and manual status generation plus Pages deployment and post-deploy verification.
- `.github/workflows/status-freshness-watch.yml`: deployed-payload age check and bounded recovery dispatch that defers while a release is active.

The Pages release path uses one `pages-release` concurrency group with in-progress cancellation disabled. Every release event runs tests, type checking, dependency audit, live collection, payload validation, build, Pages publication, production smoke, normal browser rendering, and exact Yodeck verification.

## GitHub monitoring architecture

GitHub is a production provider with high criticality and priority 90. It uses the public first-party source:

```text
https://www.githubstatus.com/api/v2/summary.json
```

The structured Statuspage adapter preserves:

- unresolved incident title and lifecycle;
- first detection and latest update timestamps;
- latest official incident note;
- official incident link;
- affected components;
- component-level current states;
- scheduled maintenance as a separate record type.

The declared service scope includes Git Operations, API Requests, Actions, GitHub Pages, Webhooks, Pull Requests, and Issues.

A readable GitHub Status response may support an operational or incident conclusion. A failed or unreadable response produces only a source-health gap. Repository API failures, failed workflows, deployment failures, and synthetic requests are not GitHub service evidence.

Deterministic coverage validates GitHub provider metadata, structured incident and component parsing, provider loading, and the generated `GH` icon label.

## Runtime behavior

The browser requests only static assets and `status.json`. The operator application keeps the one-minute browser payload-check cadence. Wallboard mode also defaults to one minute, but can override that cadence with the `refresh` URL parameter. A payload older than 20 minutes produces a freshness warning. Browser check and payload ages are maintained in React state and rendered directly into the wallboard without a DOM enhancement module.

The operator application exposes incidents, provider diagnostics, source reliability, request evidence, maintenance intelligence, timeline history, and cautious communication drafts.

The active wallboard presents newest-first vendor incidents. In compact mode the active-provider rail occupies the top row, with provider icons and names scrolling horizontally when needed. Payload and browser freshness telemetry remain fixed at the right. The incident list occupies the remaining height and loops vertically when needed. Maintenance and collector failures are excluded from Priority signals. The target non-interactive Yodeck region is 458 by 291 pixels.

Complete incident detail remains present in compact mode. The current TV-specific rules use an 11-pixel gap between the provider icon column and the incident text column, preserve provider name and update age, and keep title and detail text unclamped.

## Browser refresh URL contract

`src/wallboardRoute.ts` owns refresh parsing through `parseRefreshIntervalMs` and `readWallboardRoute`.

Accepted units are:

- seconds: `refresh=30s`;
- minutes: `refresh=1m` or `refresh=5m`;
- hours: `refresh=1h`.

The accepted interval range is 15 seconds through one hour. Missing, malformed, too-small, or too-large values return `DEFAULT_BROWSER_REFRESH_MS`, which is one minute.

`App.tsx` applies the parsed custom interval only when `route.wallboardMode` is true:

```text
wallboard mode -> route.refreshIntervalMs
operator mode  -> DEFAULT_BROWSER_REFRESH_MS
```

This separation keeps the operator console's existing refresh-countdown contract truthful even when a wallboard URL contains a custom interval.

The refresh loop continues to respect page visibility. The scheduled interval checks `document.hidden` before starting a browser retrieval. The option controls retrieval and validation of the deployed static `status.json` only. It does not invoke vendor sources directly, trigger a GitHub Actions collection run, or control Yodeck's full-page Refresh Interval.

## Wallboard ownership contract

React owns:

- incident filtering and ordering;
- provider deduplication;
- duplicate groups for seamless loops;
- header mode and local-storage persistence;
- overlay control rendering;
- payload and browser freshness telemetry;
- wallboard route and refresh state;
- the Yodeck layout-probe state.

`wallboard-v2.css` owns the normal wallboard-specific geometry, overlay presentation, compact breakpoints, and marquee animation for browsers with CSS Cascade Layer support. Shared application design tokens and generic base wallboard primitives may remain in `command-center.css`.

`wallboard-compat.css` is a compatibility-only structural fallback. It is loaded after `wallboard-v2.css`, contains no `@layer` block, and scopes its selectors to `html.no-css-layers`. `main.tsx` adds that marker only when `CSSLayerBlockRule` is unavailable. This keeps the approved modern Chromium presentation unchanged while allowing older signage Chromium builds to receive equivalent structural rules.

`wallboard-tv.css` is loaded after the modern and compatibility presentation paths. It contains one compact TV media query and adjusts presentation only. It must not change incident selection, filtering, provider ownership, refresh ownership, or collection behavior.

The runtime must not add a MutationObserver, query and replace rendered signal articles, clone live DOM nodes, inject runtime styles, or load a second wallboard controller.

## Physical TV presentation history

The physical 46-inch Yodeck deployment is the practical acceptance environment for compact wallboard readability.

The recent presentation work deliberately separates information preservation from density tuning:

1. PR 78 introduced compact TV tuning while keeping full incident descriptions visible.
2. PR 79 moved the active-provider marquee into the compact top row and moved incident age onto the provider line to recover width.
3. PR 80 restored provider names beside header icons and increased incident padding, line height, and card separation after physical-TV review showed the content was too compressed.
4. PR 81 increased the incident icon-to-text gap from 8 pixels to 11 pixels after another physical-TV review.

The current contract specifically prevents compact mode from hiding or line-clamping incident paragraphs. This protects the operational detail that the TV is intended to surface.

## Yodeck legacy-browser compatibility

### Observed failure

The physical Yodeck deployment exposed a browser compatibility gap that the normal modern-Chromium production probe did not reproduce.

When the web page occupied a small Yodeck region, the region could render blank. When the same page was made full-screen, the application and data loaded, but the UI collapsed into vertically stacked KPI blocks instead of the intended compact Priority signals wallboard.

This established that networking, GitHub Pages, React startup, `status.json`, and route parsing were functioning. The failure was presentation-specific.

### Root cause

The primary wallboard structural rules are inside CSS Cascade Layers. An older Chromium build without Cascade Layer support can ignore those layered blocks. Unlayered responsive CSS can still apply, including the mobile rule that hides `.wallboard-shell` below 900 pixels. Without the layered wallboard override, a small signage region can therefore become blank. At larger widths the page can remain visible while losing the intended grid and compact wallboard geometry.

### Compatibility design

PR 74 introduced a narrow fallback instead of changing the normal wallboard architecture:

1. `main.tsx` checks for `CSSLayerBlockRule` before mounting React.
2. Browsers without that capability receive `html.no-css-layers`.
3. `wallboard-compat.css` provides unlayered structural rules only beneath that marker.
4. The fallback reproduces fixed wallboard geometry, compact media queries, provider and incident layouts, overlay visibility, and marquee keyframes.
5. Modern browsers never match those selectors and continue using the existing layered wallboard presentation.

This design preserves the single React wallboard ownership model. The fallback has no separate state, data path, rendering tree, or DOM controller.

### Validation and production evidence

PR 74, `Fix Yodeck wallboard rendering on pre-layer Chromium`, passed pull-request checks and merged into `main` at commit `33f7d873a3a22000030beec23091027b4fc9cee8`.

Production release run 614 completed successfully after the merge. The release included the full first-party collection and payload gate, production smoke, normal browser rendering, exact 458 by 291 Yodeck verification, artifact publication, and deployment identity verification.

The production verification uses modern Chromium, so the physical TV remains the acceptance point for the legacy fallback itself. The automated contract ensures that the existing modern layout is not changed and that the fallback remains structurally present for browsers without Cascade Layer support.

## Online help architecture

`public/help.html` is a static, script-free help document. It is copied into the built Pages artifact by Vite and deploys at `/sst/help.html`.

The help page documents:

- the recommended 46-inch wallboard URL;
- `alerts` duration syntax and range;
- `refresh` duration syntax, range, default, and fallback behavior;
- payload-age and browser-check-age meanings;
- the distinction between browser payload polling, GitHub Actions collection, and Yodeck full-page refresh;
- compact provider rail and incident-list behavior;
- Yodeck configuration guidance;
- repository documentation and source links.

The static design intentionally introduces no runtime JavaScript, external font, analytics, credential, or network dependency beyond ordinary document and link loading.

The run 623 GitHub Pages artifact was downloaded and inspected after the successful production deployment. It contains `help.html` with the current `refresh=1m` recommendation, refresh bounds, and Browser telemetry explanation.

## Deployment identity

`public/deploy-version.txt` is generated during `npm run build:app` with:

- the workflow commit from `GITHUB_SHA`;
- the workflow run ID from `GITHUB_RUN_ID`;
- an ISO generation timestamp.

`production-smoke.mjs` retrieves the deployed marker and rejects a release when the deployed commit or run ID differs from the workflow being verified. This separates artifact creation from proof that the intended revision is actually live.

## Security posture

- No credentials or secrets are stored in the repository or browser.
- No server runtime or database exists.
- No authenticated tenant APIs are used.
- No commercial status aggregation service is a runtime dependency.
- No crowdsourced outage data is treated as operational truth.
- No browser-side vendor collection occurs.
- Build permissions are read-only.
- Pages and OIDC write permissions are restricted to the deploy job.
- GitHub monitoring uses the public GitHub Status source and does not require repository credentials.
- The Yodeck compatibility path introduces no network endpoint, credential, persistence layer, or data-source change.
- The `refresh` URL option changes only retrieval frequency for the repository's deployed `status.json` and does not authorize new data sources.
- The online help page is static and script-free.

## Current operational state

Step 1 stabilization and Step 2 architecture cleanup are complete on main. PR 71 merged the consolidated React-owned wallboard architecture, generated deployment identity, and exact viewport verification changes. Scheduled production runs 606, 607, 608, 610, and 611 passed, and freshness-watch run 29 completed successfully.

PR 69 merged GitHub monitoring at commit `2f5dc9c1f644982b4f31e58839d6070a5388d719`. Pull-request run 311 passed the deterministic gate, and production release run 612 passed live collection, payload reconciliation, Pages publication, production smoke, normal browser rendering, exact 458 by 291 Yodeck verification, artifact upload, and deployed-intelligence verification.

PR 74 merged the Yodeck legacy-browser compatibility fallback at commit `33f7d873a3a22000030beec23091027b4fc9cee8`. Pull-request checks passed before merge, and production release run 614 completed successfully.

PR 81, `Add URL-controlled wallboard refresh and online help`, passed pull-request run 322 and merged at commit `43e25da05e1178109b32ca5dcb0f68fcc98904b4`. Production release run 623 passed the complete build and deployment path, including live collection, browser validation, exact 458 by 291 Yodeck verification, artifact upload, and deployed-intelligence verification.

The run 623 Yodeck screenshot contained no incidents in its selected 36-hour verification window, so it could not visually show the 11-pixel incident gap. The compact TV test verifies that rule directly, and the physical TV remains the correct acceptance environment for viewing-distance judgments.

GitHub monitoring, the Yodeck compatibility fallback, current physical-TV tuning, URL-controlled browser refresh, and the deployed online help are therefore production-validated through the repository release gate.

See [system-status.md](system-status.md), [wallboard-url-options.md](wallboard-url-options.md), and [open-issues.md](open-issues.md) for current completion and deployment guidance. The deployed online help is available at `https://dmo18.github.io/sst/help.html`.
