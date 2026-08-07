# Current system status

Status timestamp: 2026-08-07 14:36 Eastern Time

This report records the current repository, production, and release state after Step 1 stabilization and Step 2 architecture cleanup completed their validation gates. GitHub provider monitoring is the only active feature release still in progress.

## Executive status

| Area | Status | Notes |
| --- | --- | --- |
| Repository access | Healthy | Connected GitHub access supports repository, pull-request, workflow, deployment inspection, and repository writes. |
| Main branch | Healthy | Current main head is `1d1bb2c13ee787d0fd7c706c1e79140fe9baadee`. |
| Application validation | Healthy | Current production releases run provider validation, deterministic tests, TypeScript, dependency audit, live collection, payload validation, build, deployment, production smoke, normal browser render, and exact Yodeck verification. |
| GitHub Pages publication | Healthy | Scheduled release run 611 completed successfully on 2026-08-07. |
| Scheduled reliability proof | Complete | Multiple scheduled releases have completed successfully, including runs 606, 607, 608, 610, and 611. |
| Freshness recovery | Healthy | Freshness-watch run 29 completed successfully alongside the latest scheduled release cycle. |
| Step 1 stabilization | Complete | Release serialization, freshness coordination, production smoke, exact viewport testing, and scheduled reliability evidence are complete. |
| Step 2 architecture cleanup | Complete | PR 71 merged to main and the consolidated React-owned wallboard architecture is live. |
| GitHub provider monitoring | In progress | PR 69 is being refreshed on current main and validated before merge. |

## Repository identity

- Repository: `dmo18/sst`
- Visibility: public
- Default branch: `main`
- Package: `msp-status-hud`
- Package version: `3.3.0`
- Runtime: React 18, TypeScript 5.7, Vite 6, Node 22+
- Current production catalog before PR 69: 78 active providers after consolidation from 79 raw entries
- Catalog after PR 69: 79 active providers after consolidation from 80 raw entries
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

Scheduled releases 606, 607, 608, 610, and 611 completed successfully. The prior requirement for two consecutive successful scheduled releases is therefore satisfied.

## Completed Step 2 architecture cleanup

PR 71, `Complete Step 2 architecture cleanup`, merged into main at commit `651e58db8bada977640b9956d7f27069097c7af3`.

The current architecture:

1. Uses `src/WallboardV2.tsx` as the sole wallboard implementation.
2. Removes `src/Wallboard.tsx`, `src/wallboard.ts`, and `src/wallboardDomEnhancements.ts`.
3. Keeps wallboard header state, overlay controls, freshness telemetry, filtering, ordering, and marquee ownership in React.
4. Uses `src/styles/wallboard-v2.css` as the dedicated wallboard stylesheet.
5. Generates `public/deploy-version.txt` during the build rather than tracking it in source.
6. Verifies deployed commit and workflow identity in production smoke testing.
7. Uses Chrome DevTools device metrics for an actual 458 by 291 CSS viewport.
8. Includes regression contracts preventing the removed legacy ownership paths from returning.

## Active wallboard behavior

Production provides:

- newest-first vendor incident sorting;
- provider icons and labels;
- routine maintenance and collector-failure exclusion from Priority signals;
- rolling URL alert windows such as `alerts=36h`;
- a horizontally looping provider rail;
- a vertically looping incident list;
- inline payload and browser freshness ages;
- auto, pinned-open, and pinned-closed overlay modes;
- local persistence of header mode;
- compact geometry optimized for the 458 by 291 Yodeck tile.

## GitHub provider monitoring

PR 69 adds GitHub as a high-criticality DevOps provider using the official public GitHub Status summary API.

The intended contract is:

- first-party and unauthenticated collection only;
- structured Statuspage JSON adapter;
- explicit monitoring of Git Operations, API Requests, Actions, GitHub Pages, Webhooks, Pull Requests, and Issues;
- preservation of incident lifecycle, timestamps, official links, affected components, and component states;
- source failure treated only as an observation gap;
- repository API failures, failed workflows, and synthetic requests never treated as GitHub service-health evidence.

PR 69 has been reconstructed on top of the current main baseline so it no longer carries stale pre-Step-2 source state. It remains incomplete until its deterministic PR checks pass and the merge release completes the normal production gate.

## Remaining risks and work

### GitHub provider release

PR 69 must pass deterministic pull-request checks, merge cleanly, and complete the production release path before GitHub monitoring is considered live.

### Repository issue tracking

Repository Issues remain unused for the current backlog. `docs/open-issues.md` remains the small authoritative register until issue tracking is enabled and any remaining work is migrated.

## Completion order

1. Pass PR 69 pull-request validation.
2. Merge PR 69.
3. Confirm the merged revision completes the full Pages, production smoke, browser, and exact Yodeck release gate.
4. Mark GitHub provider monitoring complete in `docs/open-issues.md` and this document.
