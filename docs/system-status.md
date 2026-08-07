# Current system status

Status timestamp: 2026-08-07 16:48 Eastern Time

This report records the current repository, production, and release state after Step 1 stabilization, Step 2 architecture cleanup, GitHub provider monitoring, Yodeck legacy-browser compatibility, physical-TV layout tuning, URL-controlled browser refresh, and deployed wallboard help completed their production gates.

## Executive status

| Area | Status | Notes |
| --- | --- | --- |
| Repository access | Healthy | Connected GitHub access supports repository, pull-request, workflow, deployment inspection, and repository writes. |
| Runtime feature baseline | Healthy | PR 81 merged the current wallboard refresh, spacing, documentation, and online-help implementation at commit `43e25da05e1178109b32ca5dcb0f68fcc98904b4`. |
| Application validation | Healthy | Provider validation, deterministic tests, TypeScript, dependency audit, live collection, payload validation, build, deployment, production smoke, normal browser render, and exact Yodeck verification are green. |
| GitHub Pages publication | Healthy | Production release run 623 published the PR 81 runtime successfully. |
| Online help | Healthy | `public/help.html` is included in the run 623 GitHub Pages artifact and documents current wallboard and Yodeck URL options. |
| Scheduled reliability proof | Complete | Scheduled releases 606, 607, 608, 610, and 611 completed successfully. |
| Freshness recovery | Healthy | Freshness-watch run 29 completed successfully alongside the scheduled release cycle. |
| Step 1 stabilization | Complete | Release serialization, freshness coordination, production smoke, exact viewport testing, and scheduled reliability evidence are complete. |
| Step 2 architecture cleanup | Complete | PR 71 merged and the consolidated React-owned wallboard architecture is live. |
| GitHub provider monitoring | Complete | PR 69 passed PR checks, merged, and passed the full production release gate in run 612. |
| Yodeck legacy-browser compatibility | Complete | PR 74 passed pull-request checks, merged, and passed the full production release gate in run 614. |
| Physical TV layout tuning | Healthy | PRs 78, 79, and 80 refined the compact 458 by 291 wallboard while retaining complete incident detail and provider identity. |
| URL-controlled browser refresh | Complete | PR 81 added bounded `refresh=` parsing and wallboard-only polling control with a one-minute default. |

## Repository identity

- Repository: `dmo18/sst`
- Visibility: public
- Default branch: `main`
- Package: `msp-status-hud`
- Package version: `3.3.0`
- Runtime: React 18, TypeScript 5.7, Vite 6, Node 22+
- Production catalog: 79 active providers after consolidation from 80 raw entries
- Collection pipeline version: `3.0.0`
- Hosting: GitHub Pages
- Backend: none
- Database: none
- Runtime secrets: none

## Completed Step 1 stabilization

The production release path is serialized under one `pages-release` concurrency group with in-progress cancellation disabled. Every release event uses the same validation and publication path. Freshness recovery defers while a release is active and does not cancel or duplicate the release.

The release path verifies:

- dependency installation;
- provider catalog validation;
- deterministic tests;
- TypeScript checking;
- production dependency audit;
- live first-party collection;
- browser payload validation;
- collection and freshness reconciliation;
- Vite application build;
- Pages artifact upload;
- GitHub Pages deployment;
- deployed asset and payload smoke testing;
- normal headless browser rendering;
- exact 458 by 291 Yodeck verification;
- Yodeck DOM and screenshot artifact upload;
- deployed commit and run identity.

Scheduled releases 606, 607, 608, 610, and 611 completed successfully, satisfying the prior consecutive scheduled-release requirement.

## Completed Step 2 architecture cleanup

PR 71, `Complete Step 2 architecture cleanup`, merged into main at commit `651e58db8bada977640b9956d7f27069097c7af3`.

The current architecture:

1. Uses `src/WallboardV2.tsx` as the sole wallboard implementation.
2. Removes `src/Wallboard.tsx`, `src/wallboard.ts`, and `src/wallboardDomEnhancements.ts`.
3. Keeps wallboard header state, overlay controls, freshness telemetry, filtering, ordering, and marquee ownership in React.
4. Uses `src/styles/wallboard-v2.css` as the dedicated modern-browser wallboard stylesheet.
5. Uses `src/styles/wallboard-compat.css` only as a gated compatibility fallback for browsers without CSS Cascade Layer support.
6. Uses `src/styles/wallboard-tv.css` for compact 458 by 291 physical-TV spacing and readability tuning without changing incident data ownership.
7. Generates `public/deploy-version.txt` during the build rather than tracking it in source.
8. Verifies deployed commit and workflow identity in production smoke testing.
9. Uses Chrome DevTools device metrics for an actual 458 by 291 CSS viewport.
10. Includes regression contracts preventing the removed legacy ownership paths from returning.

## Active wallboard behavior

Production provides:

- newest-first vendor incident sorting;
- provider icons and provider names;
- routine maintenance and collector-failure exclusion from Priority signals;
- rolling URL alert windows such as `alerts=24h` and `alerts=36h`;
- a horizontally looping active-provider rail in the compact top row;
- payload and browser freshness telemetry fixed at the right side of the compact top row;
- a vertically looping incident list;
- complete incident provider, age, title, and detail text;
- compact incident icon-to-text spacing tuned for the physical 46-inch TV;
- auto, pinned-open, and pinned-closed overlay modes;
- local persistence of header mode;
- compact geometry optimized for the 458 by 291 Yodeck tile;
- a legacy signage fallback that preserves wallboard structure when CSS Cascade Layers are unavailable;
- URL-controlled wallboard browser payload checks through `refresh=`;
- deployed static online help at `/sst/help.html`.

## Browser refresh URL contract

PR 81 added URL control for the browser-side payload check without changing collection cadence.

Accepted wallboard forms include:

```text
?view=wallboard&alerts=24h&refresh=30s
?view=wallboard&alerts=24h&refresh=1m
?view=wallboard&alerts=24h&refresh=5m
?view=wallboard&alerts=24h&refresh=1h
```

The contract is:

- units: seconds, minutes, or hours;
- minimum: 15 seconds;
- maximum: one hour;
- default: one minute;
- missing or invalid values: one-minute fallback;
- custom interval applies only while wallboard mode is active;
- hidden pages do not execute scheduled payload checks until visible;
- the option controls browser retrieval and validation of the deployed `status.json` only;
- the option does not trigger GitHub Actions, vendor retrieval, or Yodeck full-page reloads.

The compact `Browser` telemetry value is the age since the most recent successful browser payload check. It is not the configured refresh interval.

## Physical TV layout tuning

The physical 46-inch Yodeck display has been used as the acceptance environment for compact readability changes.

The current compact design preserves all operational incident detail while using the available 458 by 291 region more effectively:

- active-provider icons and names replace the visible `PRIORITY SIGNALS` label in the compact top row;
- the provider rail retains horizontal marquee behavior when it overflows;
- payload and browser freshness remain fixed at the right;
- incident ages remain on the provider line rather than consuming a dedicated right-side column;
- incident descriptions remain fully rendered and are not hidden or line-clamped;
- card padding, line height, title spacing, and inter-card separation preserve readability;
- the provider icon-to-text gap in the main incident list is 11 pixels in compact TV mode.

PR 78 established the full-detail compact TV stylesheet. PR 79 moved the provider marquee into the compact top row. PR 80 restored provider names and increased incident breathing room after physical-TV review. PR 81 made the final icon-to-text spacing adjustment requested from the physical display.

The run 623 automated screenshot contained no incidents inside its selected 36-hour verification window, so it could not visually demonstrate the incident-row spacing adjustment. The compact CSS regression test verifies the 11-pixel gap, and the exact 458 by 291 production layout contract passed.

## Yodeck compatibility fix

PR 74, `Fix Yodeck wallboard rendering on pre-layer Chromium`, addressed a player-specific compatibility failure observed on the physical TV.

The failure had two visible modes:

- when the web page occupied a smaller Yodeck region, the wallboard could become blank;
- when the page occupied the full display, data loaded but the wallboard structure collapsed into vertically stacked KPI blocks instead of the compact Priority signals presentation.

The application and payload were healthy. The root cause was CSS feature compatibility. Core wallboard structure is intentionally kept inside CSS Cascade Layers. On a Chromium build without Cascade Layer support, those layered rules can be ignored while unlayered responsive rules remain active. At small widths, that could leave `.wallboard-shell { display: none; }` active without the layered wallboard override. At larger widths, the page remained visible but lost the intended wallboard geometry.

The production fix:

1. Detects Cascade Layer support through `CSSLayerBlockRule` before React renders.
2. Adds `no-css-layers` to the root HTML element only when that browser feature is unavailable.
3. Loads `src/styles/wallboard-compat.css` after the existing wallboard stylesheet.
4. Scopes every compatibility selector to `html.no-css-layers` so modern Chromium keeps the existing presentation unchanged.
5. Recreates the structural wallboard geometry, compact breakpoints, overlay behavior, provider rail, incident rows, and marquee animation without using `@layer`.
6. Adds deterministic regression coverage requiring the fallback to remain gated and unlayered.

PR 74 pull-request checks completed successfully before merge. The fix merged at commit `33f7d873a3a22000030beec23091027b4fc9cee8`. Production release run 614 then completed successfully, including the existing 458 by 291 Yodeck verification and the full Pages release gate.

## Online help

PR 81 added `public/help.html`, which Vite copies into the deployed Pages artifact as `help.html`.

The help page documents:

- the recommended 46-inch TV wallboard URL;
- alert-window syntax and bounds;
- browser refresh syntax, bounds, default, and fallback behavior;
- the difference between payload age, browser-check age, browser polling, GitHub Actions collection, and Yodeck full-page refresh;
- current compact provider-rail and incident behavior;
- Yodeck configuration guidance;
- links back to the repository wallboard documentation and project source.

The run 623 Pages artifact was inspected after deployment and contains `help.html` with the `refresh=1m` recommendation and browser-refresh documentation.

## GitHub provider monitoring

PR 69, `Monitor GitHub platform status`, merged at commit `2f5dc9c1f644982b4f31e58839d6070a5388d719` after pull-request run 311 passed provider validation, deterministic tests, TypeScript checking, application build, and dependency audit.

Production release run 612 then completed successfully, including live first-party collection, browser payload compatibility, collection reconciliation, Pages publication, production smoke, normal headless browser rendering, exact 458 by 291 Yodeck verification, verification artifact upload, and deployed-intelligence status publication.

GitHub is now a high-criticality DevOps provider using the official public GitHub Status summary API. The contract is:

- first-party and unauthenticated collection only;
- structured Statuspage JSON adapter;
- explicit monitoring of Git Operations, API Requests, Actions, GitHub Pages, Webhooks, Pull Requests, and Issues;
- preservation of incident lifecycle, timestamps, official links, affected components, and component states;
- source failure treated only as an observation gap;
- repository API failures, failed workflows, and synthetic requests never treated as GitHub service-health evidence.

## Latest production proof

PR 81, `Add URL-controlled wallboard refresh and online help`, passed pull-request run 322 and merged at commit `43e25da05e1178109b32ca5dcb0f68fcc98904b4`.

Production release run 623 completed successfully. The release passed:

- provider validation;
- deterministic tests;
- TypeScript checking;
- production dependency audit;
- live first-party collection;
- browser payload validation;
- truthful coverage and freshness verification;
- application build;
- Pages artifact creation and deployment;
- deployed asset and payload smoke testing;
- normal browser rendering;
- exact 458 by 291 Yodeck verification;
- Yodeck artifact upload;
- deployed intelligence verification.

This is the production proof for the current URL-controlled refresh and compact-spacing runtime change. Documentation-only commits after this proof do not change the runtime behavior described above.

## Remaining work

No Step 1, Step 2, GitHub-monitoring, Yodeck compatibility, browser-refresh, or online-help engineering item remains open in this register.

Physical TV review remains the practical acceptance loop for future visual tuning because automated Chromium can verify geometry and contracts but cannot reproduce viewing distance and signage-player rendering exactly.

Repository issue tracking remains an administrative task. See `docs/open-issues.md`.
