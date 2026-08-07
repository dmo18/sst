# Open issues and stabilization register

Last reviewed: 2026-08-07

This file is the temporary authoritative backlog until repository Issues is enabled and any remaining work is migrated into issue records.

## Completed stabilization work

### Step 1 production stabilization

- [x] Serialize every Pages release under one `pages-release` concurrency group.
- [x] Disable in-progress release cancellation.
- [x] Remove the superseded Pages deployment cancellation step.
- [x] Run deterministic tests, TypeScript checking, production dependency audit, live collection, payload validation, production build, deployment, smoke checks, and browser rendering for every release event, including schedules.
- [x] Prevent freshness recovery from dispatching while a release is queued or active.
- [x] Keep unattended vertical and horizontal wallboard marquees running when content overflows.
- [x] Apply the `alerts=36h` window to both incident rows and the provider rail.
- [x] Replace unreliable Chrome `--window-size` verification with Chrome DevTools device metrics at an actual 458 by 291 CSS viewport.
- [x] Verify compact geometry, overlay separation, page overflow, freshness telemetry, alert-window filtering, and marquee state in the deployed browser.
- [x] Upload exact Yodeck DOM and screenshot evidence.
- [x] Complete controlled production release validation.
- [x] Complete multiple successful scheduled releases without freshness-watch interference.

Scheduled production runs 606, 607, 608, 610, and 611 completed successfully. Freshness-watch run 29 also completed successfully.

### Step 2 architecture cleanup

- [x] Remove `src/Wallboard.tsx`, the unused legacy wallboard component.
- [x] Remove `src/wallboard.ts` and its obsolete rotation, pagination, and legacy settings contract.
- [x] Remove `src/wallboardDomEnhancements.ts` and move header state, overlay controls, and freshness telemetry into React.
- [x] Remove `src/styles/wallboard-focus.css` and consolidate dedicated wallboard styling into `src/styles/wallboard-v2.css`.
- [x] Keep shared application tokens and generic base primitives in `command-center.css` without restoring a second wallboard controller.
- [x] Remove the stale checked-in `public/deploy-version.txt` marker.
- [x] Generate deployment identity during `npm run build:app` from `GITHUB_SHA`, `GITHUB_RUN_ID`, and generation time.
- [x] Verify deployed commit and run identity during production smoke testing.
- [x] Add regression contracts preventing the legacy component, imperative controller, split wallboard stylesheet, and checked-in deployment marker from returning.
- [x] Update current architecture and operator documentation.
- [x] Merge Step 2 through PR 71.
- [x] Complete the post-merge production release path and exact Yodeck verification.

## Active engineering work

### 1. Complete GitHub platform monitoring

PR 69 adds GitHub as a high-criticality DevOps provider using the official public GitHub Status summary API.

Completed in source:

- [x] Add the GitHub provider entry.
- [x] Use the public first-party GitHub Status summary API.
- [x] Declare high criticality and technician guidance.
- [x] Monitor Git Operations, API Requests, Actions, GitHub Pages, Webhooks, Pull Requests, and Issues.
- [x] Preserve structured incident lifecycle, timestamps, official links, affected components, and component states.
- [x] Keep GitHub source health separate from GitHub service health.
- [x] Add deterministic provider metadata, structured incident, provider-loading, and icon validation.
- [x] Refresh the feature branch onto the current main architecture without restoring pre-Step-2 files.
- [x] Reconcile current repository and system documentation.

Completion evidence still required:

- [ ] PR 69 pull-request checks complete successfully.
- [ ] PR 69 is merged.
- [ ] The merged revision completes the full Pages release path.
- [ ] Production smoke verifies the deployed revision and payload.
- [ ] Exact 458 by 291 Yodeck verification remains green.
- [ ] The deployed payload includes GitHub within 79 active providers after consolidation from 80 raw entries.

## Administrative work

### 2. Enable GitHub Issues

Enable repository Issues in Settings, General, Features, Issues.

### 3. Migrate the remaining register

After Issues is enabled, create issue records for any still-open work, assign priority and owner, add acceptance criteria, and link production evidence before closure.

## Change control

Step 1 and Step 2 are complete. New work should preserve the current single-wallboard React ownership model, the static first-party-only trust model, the serialized Pages release path, fail-closed source semantics, and exact Yodeck verification.

GitHub monitoring is the only active feature release recorded here. It is not complete until PR validation, merge, and production release evidence all succeed.
