# Current system status

Audit timestamp: 2026-08-06 11:13 Eastern Time

This report records the repository and production state after a repository-wide file inventory and subsystem review. No runtime source, collector logic, styling, or workflow behavior was changed by this documentation audit.

## Executive status

| Area | Status | Notes |
| --- | --- | --- |
| Repository access | Healthy | The connected GitHub app has admin, maintain, push, triage, and pull access to `dmo18/sst`. |
| Main branch | Builds successfully | Current head before this documentation commit: `706452fc8d3e320912ca3f1b00143e71ddb45290`. |
| Application tests | Healthy | The current-head build job passed provider validation, 139 deterministic tests, TypeScript checking, dependency audit, live collection, payload validation, collection reconciliation, Vite build, and artifact upload. |
| GitHub Pages deployment | Degraded | The current-head deploy job failed inside `actions/deploy-pages@v4` after five minutes. Post-deploy smoke and browser checks were skipped. |
| Last successful production release | Healthy but behind main | Workflow run `31112155899` successfully deployed commit `9f7702b708ad57597221678751b5cf0f59eaf787` and passed production smoke and headless-browser checks. |
| Wallboard alert-window code | Present and tested | `alerts=36h` is parsed by `src/wallboardRoute.ts` and applied to incident selection in `src/WallboardV2.tsx`. |
| Compact Yodeck target | Documented | Primary target is 458 by 291 pixels. A dedicated production screenshot assertion at that exact size is still recommended. |

## Repository audit scope

Every tracked path was enumerated through the GitHub tree and directory APIs. The review covered:

- Root configuration and metadata.
- Provider catalog and consolidation configuration.
- Every active Markdown document.
- React entry points, operator UI, wallboard implementations, route parsing, payload validation, lifecycle, telemetry, icons, types, and view models.
- All application styles, including mobile, ultra-HD, wallboard overlay, and compact wallboard layers.
- Collector, parser, source-intelligence, incident-freshness, repair, validation, build, and production-smoke scripts.
- Script and application test suites.
- GitHub Actions workflows.
- Public static assets and the last successful Pages artifact.

SVG logo assets were inventoried as static assets. Historical release documentation was reviewed but preserved as historical material.

## Repository identity

- Repository: `dmo18/sst`
- Visibility: public
- Default branch: `main`
- Package: `msp-status-hud`
- Package version: `3.3.0`
- Runtime: React 18, TypeScript 5.7, Vite 6, Node 22+
- Active provider catalog: 78 providers after consolidation from 79 raw entries
- Collection pipeline version: `3.0.0`
- Hosting: GitHub Pages
- Backend: none
- Database: none
- Runtime secrets: none

## Last successful deployed artifact

The Pages artifact from successful workflow run `31112155899` was downloaded and inspected directly.

- Deployed source commit: `9f7702b708ad57597221678751b5cf0f59eaf787`
- Payload generated at: `2026-08-06T14:43:06.928Z`
- Provider total: 78
- Live readable sources: 64
- Live-source coverage: 82 percent
- Collection quality score: 72
- Blind spots: 13
- Requests: 93 total, 76 successful, 17 failed
- Active incident records in the payload: 6
- Maintenance records in the payload: 35
- Change records: 3

The payload contains one N-able incident whose latest update was about 47 hours old at generation time. That record remains valid payload history, but the `alerts=36h` wallboard route is designed to exclude it from the rendered wallboard because the filter uses `latest_update` through the action-queue model.

## Implemented wallboard work

The active wallboard is `src/WallboardV2.tsx`. Current behavior includes:

- Newest-first incident sorting by latest vendor update.
- Provider icons in incident rows instead of numeric indexes.
- Routine maintenance excluded from the operational application unless emergency work is in progress and explicitly affects production.
- Collector failures and unreadable-source notices excluded from Priority signals.
- Continuous vertical marquee using two React-rendered incident groups.
- Continuous horizontal marquee using two React-rendered provider-chip groups.
- Provider chips include both icon and provider name.
- Compact mode removes Provider Watch and the footer so Priority signals uses the available tile.
- Inline payload-age and browser-check telemetry in the Priority signals heading.
- Full header and KPI strip controlled as one overlay.
- Header modes: auto hide, pinned open, and pinned closed.
- A small Show header control when the overlay is pinned closed.
- Browser local storage persistence for the selected header mode.
- URL-controlled rolling incident windows such as `alerts=36h`.
- Shared filtering for both the incident marquee and provider rail.
- Responsive compact geometry that activates at widths below 1180 pixels or heights below 520 pixels.

The provider and incident marquees are implemented in React with `ResizeObserver` measurement and CSS transforms. The enhancement module is limited to overlay state and freshness telemetry. It does not reorder, clone, hide, or relocate incident rows.

## Primary Yodeck contract

The expected Yodeck region is:

- Width: 458 pixels
- Height: 291 pixels
- Interaction: none during normal operation
- Content priority: Priority signals first
- Provider rail: always visible below the heading, horizontally looping only when needed
- Incident list: continuously and smoothly looping when needed
- Header and KPI overlay: hidden by default in unattended operation and manually restorable
- Alert details: retained, but the compact layout must prevent one long record from permanently hiding the remaining incidents

## Build and test status

For current head `706452fc8d3e320912ca3f1b00143e71ddb45290`, the build job completed successfully and included:

- `npm ci`
- `npm run validate-providers`
- 139 deterministic tests
- `npm run typecheck`
- `npm audit --audit-level=high`
- one live `npm run update-status`
- browser payload validation
- collection and freshness reconciliation
- `npm run build:app`
- Pages artifact upload

This indicates that the current source tree is internally consistent and buildable. It does not prove that the current head is live because the dependent Pages deploy step failed.

## Deployment status and root cause boundary

The latest run failed only at `actions/deploy-pages@v4`. The action remained in `deployment_in_progress` until its configured five-minute limit expired. The build artifact was already complete and valid.

Important boundaries:

- This is not a TypeScript failure.
- This is not a unit-test failure.
- This is not a provider-validation failure.
- This is not a payload-validation failure.
- This is not a Vite-build failure.
- The current main branch is not confirmed live.
- The previous successful deployment remains the production baseline.

The deploy action supports a maximum internal wait of 600000 milliseconds. Settings above that value are silently capped. Repeated commits or competing recovery workflows should not be used to work around a Pages deployment that remains in progress.

## Known technical risks

### 1. Pages release reliability

The current workflow attempts to inspect and cancel the immediately superseded Pages deployment before publishing. The latest deployment still failed inside the Pages action. This path needs one controlled repair after the Pages environment state is inspected, not repeated release commits.

### 2. Two wallboard components

Both `src/Wallboard.tsx` and `src/WallboardV2.tsx` remain in the repository. `App.tsx` uses `WallboardV2`. The older component is a maintenance risk and should be removed after confirming that no tests or imports require it.

### 3. Layered wallboard CSS

Wallboard behavior is distributed across `command-center.css`, `wallboard-focus.css`, and `wallboard-v2.css`. The current runtime contract prevents the earlier global DOM corruption, but style ownership is still more complex than ideal.

### 4. Deployment marker is stale

`public/deploy-version.txt` contains an old hard-coded commit marker and is not a reliable source of the deployed revision. It should be generated from `GITHUB_SHA` during the build or removed.

### 5. Exact Yodeck regression coverage

The contract tests verify selectors, marquees, compact geometry, and filtering, but the repository does not yet have a deterministic 458 by 291 screenshot or DOM-geometry assertion in the normal test suite.

### 6. Freshness recovery can amplify deployment problems

The freshness watcher dispatches a new refresh when deployed data is older than 20 minutes. During a Pages platform stall, this can add pressure unless the Pages workflow concurrency policy remains strictly serialized.

## Recommended next actions

1. Freeze wallboard feature changes until deployment reliability is restored.
2. Inspect the GitHub Pages environment and current deployment object before changing workflow code.
3. Reduce the release workflow to one build, one deploy, and one bounded post-deploy verification path.
4. Add an exact 458 by 291 compact-wallboard regression check.
5. Remove the unused legacy wallboard component after import and test confirmation.
6. Generate deployment identity during the build instead of using the stale checked-in marker.
7. Keep this status document updated after each release or major operational incident.

## Documentation changes in this audit

This audit updates the current README, repository architecture report, wallboard URL guide, coding-agent guidance, and contribution guide, and adds this system-status report. The historical 2.5.0 release-scope file and release changelog remain historical records.