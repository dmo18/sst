# Current system status

Status timestamp: 2026-08-07 14:46 Eastern Time

This report records the current repository, production, and release state after Step 1 stabilization, Step 2 architecture cleanup, and GitHub provider monitoring completed their validation and production gates.

## Executive status

| Area | Status | Notes |
| --- | --- | --- |
| Repository access | Healthy | Connected GitHub access supports repository, pull-request, workflow, deployment inspection, and repository writes. |
| Main branch | Healthy | GitHub monitoring merged at commit `2f5dc9c1f644982b4f31e58839d6070a5388d719`. |
| Application validation | Healthy | Provider validation, deterministic tests, TypeScript, dependency audit, live collection, payload validation, build, deployment, production smoke, normal browser render, and exact Yodeck verification are green. |
| GitHub Pages publication | Healthy | Production release run 612 published the GitHub-monitoring merge successfully. |
| Scheduled reliability proof | Complete | Scheduled releases 606, 607, 608, 610, and 611 completed successfully. |
| Freshness recovery | Healthy | Freshness-watch run 29 completed successfully alongside the scheduled release cycle. |
| Step 1 stabilization | Complete | Release serialization, freshness coordination, production smoke, exact viewport testing, and scheduled reliability evidence are complete. |
| Step 2 architecture cleanup | Complete | PR 71 merged and the consolidated React-owned wallboard architecture is live. |
| GitHub provider monitoring | Complete | PR 69 passed PR checks, merged, and passed the full production release gate in run 612. |

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

PR 69, `Monitor GitHub platform status`, merged at commit `2f5dc9c1f644982b4f31e58839d6070a5388d719` after pull-request run 311 passed provider validation, deterministic tests, TypeScript checking, application build, and dependency audit.

Production release run 612 then completed successfully, including live first-party collection, browser payload compatibility, collection reconciliation, Pages publication, production smoke, normal headless browser rendering, exact 458 by 291 Yodeck verification, verification artifact upload, and deployed-intelligence status publication.

GitHub is now a high-criticality DevOps provider using the official public GitHub Status summary API. The contract is:

- first-party and unauthenticated collection only;
- structured Statuspage JSON adapter;
- explicit monitoring of Git Operations, API Requests, Actions, GitHub Pages, Webhooks, Pull Requests, and Issues;
- preservation of incident lifecycle, timestamps, official links, affected components, and component states;
- source failure treated only as an observation gap;
- repository API failures, failed workflows, and synthetic requests never treated as GitHub service-health evidence.

## Remaining work

No stabilization, Step 2, or GitHub-monitoring engineering item remains open in this register.

Repository issue tracking remains an administrative task. See `docs/open-issues.md`.
