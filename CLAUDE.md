# CLAUDE.md

Guidance for coding agents working on this repository.

## Goal

Build and maintain a free, static, first-party-only MSP service-intelligence application hosted on GitHub Pages.

## Non-negotiable constraints

- No server runtime.
- No database.
- No Docker requirement.
- No paid API.
- No credentials or secrets in the repository or browser.
- No authenticated tenant data.
- No browser-side vendor feed calls.
- No synthetic monitoring used as vendor-health evidence.
- No third-party outage scraping.
- No crowdsourced outage data as operational truth.
- Keep GitHub Pages static hosting.
- Fail closed when source data is missing, malformed, stale, or ambiguous.

## Current repository facts

- Package version: `3.3.0`.
- Collection pipeline: `3.0.0`.
- Raw catalog entries: 80.
- Active providers after consolidation: 79.
- Active wallboard: `src/WallboardV2.tsx`.
- Primary compact wallboard target: 458 by 291 pixels.
- Normal browser refresh interval: 180 seconds while visible.
- Payload freshness warning threshold: 20 minutes.
- GitHub is a high-criticality DevOps provider sourced from the official GitHub Status summary API.

Do not restore obsolete 90-provider assumptions unless the catalog and consolidation files are deliberately changed and validated.

## Important files

```text
config/providers.json                    raw provider catalog
config/provider-consolidation.json       active exclusions and overrides
scripts/update-status.mjs                collection orchestration
scripts/update-public-status.mjs         official-source collection
scripts/structured-source-adapters.mjs   structured adapters
scripts/ensure-valid-status.mjs          server payload validation
scripts/production-smoke.mjs             deployed production and commit-identity checks
scripts/verify-yodeck-wallboard.mjs      exact 458 by 291 CDP wallboard verification
scripts/write-deploy-version.mjs         generated release identity
src/App.tsx                              lifecycle, refresh, route, and browser-check state
src/IssueConsole.tsx                     operator application
src/WallboardV2.tsx                      sole wallboard, overlay, telemetry, and marquee owner
src/wallboardRoute.ts                    view and alert-window parsing
src/statusViewModel.ts                   action queue and UI models
src/payloadValidation.ts                 browser payload validation
src/styles/wallboard-v2.css              dedicated wallboard overlay, compact layout, and marquees
.github/workflows/refresh-pages.yml       Pages build and deployment
.github/workflows/status-freshness-watch.yml deployed freshness recovery
```

The legacy `src/Wallboard.tsx`, `src/wallboard.ts`, `src/wallboardDomEnhancements.ts`, and `src/styles/wallboard-focus.css` have been removed. Do not recreate a second wallboard implementation or imperative wallboard controller.

## Service and source semantics

Service state and source health are independent.

A provider source can be readable while the vendor state remains unknown. A source can fail while the vendor service remains unconfirmed. Never infer service health from HTTP reachability, ping, route, page color, generic prose, or a collector error.

Do not create incidents from:

- source failures;
- parser failures;
- schema drift;
- bot challenges;
- login pages;
- consent pages;
- unsupported content types;
- release notes;
- marketing posts;
- resolved history;
- routine maintenance.

Emergency maintenance remains an incident only when it is in progress and explicitly describes production or customer impact.

A structurally valid fallback record is not live source coverage. `valid_status_percent` describes payload record validity only. `coverage_percent` and `live_source_coverage_percent` describe current successfully captured first-party observations.

The `status-data/live-coverage` commit status must be successful only when every active provider has live current official source coverage, no provider is blind, and no limited fallback record was needed. A truthful degraded source status must not block publication of an otherwise valid fail-closed payload.

### GitHub monitoring contract

GitHub monitoring must remain first-party and unauthenticated.

- Source: `https://www.githubstatus.com/api/v2/summary.json`.
- Adapter: structured Statuspage JSON.
- Criticality: high.
- Explicit service scope: Git Operations, API Requests, Actions, GitHub Pages, Webhooks, Pull Requests, and Issues.
- Preserve incident titles, lifecycle, first detection, latest update, official links, affected components, and component states.
- A GitHub source failure is an observation gap, not proof that GitHub is down.
- Do not use repository API failures, workflow failures, synthetic probes, or this repository's deployment state as GitHub incident evidence.

## Wallboard contract

The active wallboard must preserve these rules:

- Sort incidents by latest update, newest first.
- Show provider icons rather than numeric indexes.
- Exclude maintenance and collection-health failures from Priority signals.
- Apply the `alerts` URL window to both incident rows and provider chips.
- Keep payload and browser ages visible in the compact top rail.
- Keep the provider-chip rail fixed above the vertically moving incident list.
- Loop provider chips horizontally only when needed.
- Loop incidents vertically only when needed.
- Preserve readable provider name, title, age, and detail at 458 by 291 pixels.
- Require no interaction for unattended Yodeck operation.
- Keep header modes auto, pinned open, and pinned closed.

React owns incident selection, ordering, deduplication, duplicate loop groups, header state, overlay controls, and freshness telemetry. `wallboard-v2.css` owns wallboard-specific geometry and movement. Shared application tokens and generic base wallboard primitives may remain in `command-center.css`.

Never reintroduce:

- a MutationObserver that rewrites the wallboard;
- post-render incident sorting;
- cloned live DOM rows;
- hidden rows controlled by a separate script;
- runtime stylesheet injection;
- a second wallboard controller loaded from `index.html` or `main.tsx`;
- hover-only visibility as the sole header state;
- a second dedicated wallboard stylesheet with overlapping ownership.

## Deployment guardrails

GitHub Pages deployment is a separate failure domain from build and test.

- Keep one Pages workflow and one Pages concurrency group.
- Keep build permissions read-only.
- Restrict Pages and OIDC write permissions to the deploy job.
- Do not create separate unlock, cancel, or self-healing workflows that compete with the release workflow.
- Do not generate repeated commits to retry a stuck Pages deployment.
- `actions/deploy-pages` has a maximum internal wait of 600000 milliseconds. Larger values are capped.
- If Pages is stuck, inspect the Pages environment and deployment object before changing code.
- Scheduled freshness recovery must not interrupt an active release.
- A successful build does not mean the commit is live.
- A release is complete only after Pages publication, production smoke checks, headless rendering, and the exact Yodeck check succeed.
- `public/deploy-version.txt` is generated during the build and must not be committed.
- Production smoke must verify that the deployed commit and run IDs match `GITHUB_SHA` and `GITHUB_RUN_ID`.
- The exact Yodeck test must use Chrome DevTools device metrics rather than assuming `--window-size` equals the CSS viewport.
- Production dependency audit should use `npm audit --omit=dev --audit-level=high`; build-only tooling remains covered by lockfile updates and normal dependency maintenance without misrepresenting it as deployed runtime code.

## Commands

```bash
npm ci
npm run validate-providers
npm test
npm run typecheck
npm run build:app
npm run update-status
npm run build
npm audit --omit=dev --audit-level=high
```

`npm test` must remain deterministic and must not contact live vendors. `npm run update-status` performs one live official-source generation. Generated `status.json` and `deploy-version.txt` files are build outputs and must not be committed.

## Documentation requirements

Update documentation when behavior changes:

- `README.md` for the current product and operator contract.
- `docs/repository-report.md` for architecture.
- `docs/wallboard-url-options.md` for wallboard routes and viewport behavior.
- `docs/system-status.md` for current release and operational state.
- `docs/open-issues.md` for stabilization and architectural acceptance criteria.
- `CHANGELOG.md` for released and unreleased changes.

Do not rewrite historical release-scope files as if they described the current runtime.
