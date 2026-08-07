# Open issues and stabilization register

Last reviewed: 2026-08-07

This file is the temporary authoritative backlog until repository Issues is enabled and any remaining administrative work is migrated into issue records.

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
- [x] Remove `src/styles/wallboard-focus.css` and consolidate dedicated modern-browser wallboard styling into `src/styles/wallboard-v2.css`.
- [x] Keep shared application tokens and generic base primitives in `command-center.css` without restoring a second wallboard controller.
- [x] Remove the stale checked-in `public/deploy-version.txt` marker.
- [x] Generate deployment identity during `npm run build:app` from `GITHUB_SHA`, `GITHUB_RUN_ID`, and generation time.
- [x] Verify deployed commit and run identity during production smoke testing.
- [x] Add regression contracts preventing the legacy component, imperative controller, and checked-in deployment marker from returning.
- [x] Update current architecture and operator documentation.
- [x] Merge Step 2 through PR 71.
- [x] Complete the post-merge production release path and exact Yodeck verification.

### GitHub platform monitoring

- [x] Add GitHub as a high-criticality DevOps provider.
- [x] Use the public first-party GitHub Status summary API.
- [x] Monitor Git Operations, API Requests, Actions, GitHub Pages, Webhooks, Pull Requests, and Issues.
- [x] Preserve structured incident lifecycle, timestamps, official links, affected components, and component states.
- [x] Keep GitHub source health separate from GitHub service health.
- [x] Add deterministic provider metadata, structured incident, provider-loading, and icon validation.
- [x] Refresh the feature work onto the current main architecture without restoring pre-Step-2 files.
- [x] Pass PR 69 pull-request validation in run 311.
- [x] Merge PR 69 at commit `2f5dc9c1f644982b4f31e58839d6070a5388d719`.
- [x] Complete the full Pages production release in run 612.
- [x] Pass production smoke and deployed payload verification.
- [x] Pass normal headless browser rendering.
- [x] Pass exact 458 by 291 Yodeck verification.
- [x] Publish the 79-active-provider payload from 80 raw catalog entries.

### Yodeck legacy-browser compatibility

- [x] Reproduce the distinction between a data failure and a presentation failure from physical Yodeck screenshots.
- [x] Confirm that the application, status payload, wallboard route, and provider data load while the affected player loses wallboard structure.
- [x] Identify CSS Cascade Layer compatibility as the failure boundary for older signage Chromium builds.
- [x] Preserve the existing `WallboardV2` React component as the only wallboard implementation.
- [x] Preserve `src/styles/wallboard-v2.css` as the normal modern-browser presentation path.
- [x] Detect missing Cascade Layer support through `CSSLayerBlockRule` before React mounts.
- [x] Add `html.no-css-layers` only for browsers that lack that capability.
- [x] Add `src/styles/wallboard-compat.css` as an unlayered, marker-scoped structural fallback.
- [x] Recreate fixed wallboard geometry, compact breakpoints, provider rail, incident rows, overlay behavior, and marquee animation in the fallback.
- [x] Prevent the fallback from matching modern browsers.
- [x] Add `scripts/__tests__/wallboard-compatibility.test.js` to enforce the capability gate and required compact structure.
- [x] Pass PR 74 pull-request checks.
- [x] Merge PR 74 at commit `33f7d873a3a22000030beec23091027b4fc9cee8`.
- [x] Complete production release run 614 successfully, including the normal production smoke and exact 458 by 291 Yodeck verification.

The compatibility fix was intentionally implemented as CSS capability fallback, not as a second component, browser-specific data path, Yodeck script, DOM controller, backend, or alternate wallboard.

## Active engineering work

No stabilization, Step 2, GitHub-monitoring, or repository-side Yodeck compatibility engineering item remains open in this register.

The physical Yodeck player remains the final field confirmation point for the legacy-browser fallback because the automated production probe uses a modern Chromium runtime. If the TV shows the compact Priority signals presentation after run 614, no further compatibility work is required. If the physical player still differs, capture the screen result before changing the normal modern-browser wallboard path.

## Administrative work

### 1. Enable GitHub Issues

Enable repository Issues in Settings, General, Features, Issues.

### 2. Migrate future backlog tracking

After Issues is enabled, create issue records for future work, assign priority and owner, add acceptance criteria, and link production evidence before closure.

## Change control

Step 1, Step 2, GitHub monitoring, and the repository-side Yodeck compatibility implementation are complete. New work should preserve the current single-wallboard React ownership model, the static first-party-only trust model, the serialized Pages release path, fail-closed source semantics, exact Yodeck verification, and the capability-gated legacy signage fallback.
