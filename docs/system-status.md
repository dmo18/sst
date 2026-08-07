# Current system status

Status date: 2026-08-06 Eastern Time

This report records the current production baseline, the completed Step 1 controlled release proof, and the isolated Step 2 architectural cleanup awaiting its own validation gate.

## Executive status

| Area | Status | Notes |
| --- | --- | --- |
| Repository access | Healthy | Connected GitHub access supports repository, pull-request, workflow, and deployment inspection and writes. |
| Main branch production baseline | Healthy | Commit `428b231f454a9df65687da51b0c4b3aeb6eb2545` was deployed by workflow run `31137204360`. |
| Application validation | Healthy | The controlled release passed provider validation, deterministic tests, TypeScript, production dependency audit, live collection, payload validation, collection reconciliation, and application build. |
| GitHub Pages publication | Healthy | The controlled release completed `actions/deploy-pages@v4` successfully after the GitHub platform incident recovered. |
| Production smoke and browser render | Healthy | Deployed assets, payload, collection contract, and the normal enterprise workspace render passed. |
| Exact Yodeck contract | Healthy | Chrome DevTools device metrics established an actual 458 by 291 CSS viewport and the deployed wallboard passed its layout contract. |
| Wallboard 36-hour route | Healthy | `alerts=36h` is parsed and applied to incident rows and the provider rail. |
| Step 1 final evidence | In progress | One controlled release is proven. Two consecutive successful scheduled releases are still required. |
| Step 2 source cleanup | Implemented, not yet production | The isolated branch removes legacy wallboard ownership, moves overlay and telemetry state into React, consolidates dedicated wallboard CSS, and generates deployment identity during build. |
| GitHub provider monitoring | Draft | PR 69 remains isolated from stabilization and Step 2. |

## Repository identity

- Repository: `dmo18/sst`
- Visibility: public
- Default branch: `main`
- Package: `msp-status-hud`
- Package version: `3.3.0`
- Runtime: React 18, TypeScript 5.7, Vite 6, Node 22+
- Production provider catalog: 78 active providers after consolidation from 79 raw entries
- Collection pipeline version: `3.0.0`
- Hosting: GitHub Pages
- Backend: none
- Database: none
- Runtime secrets: none

## Controlled production proof

Workflow run `31137204360` deployed commit `428b231f454a9df65687da51b0c4b3aeb6eb2545` and completed the entire release path successfully:

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
- deployed intelligence status publication.

This closes the single controlled-release portion of Step 1.

## Yodeck verification

The previous test used Chrome `--window-size=458,291`, but the GitHub runner produced a CSS viewport of 500 by 148. The application probe correctly rejected that as an invalid test environment.

The release path now uses `scripts/verify-yodeck-wallboard.mjs` and Chrome DevTools Protocol `Emulation.setDeviceMetricsOverride` to establish and verify:

- `window.innerWidth === 458`;
- `window.innerHeight === 291`;
- device pixel ratio 1;
- Priority signals rendered;
- the 36-hour alert window applied;
- compact panel geometry valid;
- no header or KPI obstruction;
- no page overflow;
- freshness telemetry present;
- provider and incident marquees active when their content overflows;
- no out-of-window incident articles;
- a nonempty DOM artifact and PNG screenshot.

## Active wallboard behavior

`src/WallboardV2.tsx` is the sole active wallboard. Production currently provides:

- newest-first vendor incident sorting;
- provider icons and labels;
- routine maintenance and collector-failure exclusion from Priority signals;
- rolling URL alert windows such as `alerts=36h`;
- a horizontally looping provider rail;
- a vertically looping incident list;
- continuous unattended movement even when the display reports reduced motion;
- inline payload and browser freshness ages;
- auto, pinned-open, and pinned-closed overlay modes;
- local persistence of header mode;
- compact geometry optimized for the 458 by 291 Yodeck tile.

## Step 2 architectural cleanup

The isolated `agent/step2-architecture-cleanup` branch implements the following source changes without mixing in the GitHub provider addition:

1. Removes the unused `src/Wallboard.tsx` implementation.
2. Removes its obsolete `src/wallboard.ts` rotation and pagination helper plus legacy tests.
3. Removes `src/wallboardDomEnhancements.ts`.
4. Moves wallboard header mode, pointer and keyboard reveal behavior, restore control, and freshness telemetry into React state in `WallboardV2` and `App`.
5. Removes `src/styles/wallboard-focus.css` and consolidates dedicated wallboard overlay and compact behavior in `src/styles/wallboard-v2.css`.
6. Retains only shared design tokens and generic base primitives in `command-center.css`.
7. Removes the stale checked-in `public/deploy-version.txt` marker.
8. Generates `deploy-version.txt` during `npm run build:app` from `GITHUB_SHA`, `GITHUB_RUN_ID`, and generation time.
9. Extends production smoke testing to reject a deployment whose live commit or run ID does not match the workflow being verified.
10. Adds deterministic regression contracts preventing the deleted legacy ownership paths from returning.

Step 2 is not production-complete until its PR checks, merge release, normal browser render, deployment identity check, and exact Yodeck verification all pass.

## Remaining Step 1 evidence

Two consecutive scheduled `Deploy ServiceOps Enterprise Workspace` releases must complete successfully after stabilization, with no cancellation and no freshness-watch interference. This is intentionally evidence-based rather than inferred from the controlled push release.

## Remaining risks

### Scheduled reliability proof

The new serialized release path has passed one complete controlled production release. Two consecutive schedules remain the final operational reliability proof.

### Step 2 production validation

The architectural cleanup changes runtime ownership boundaries. It is protected by deterministic contracts but still requires PR and production verification before closure.

### GitHub Issues disabled

Repository Issues remain disabled. `docs/open-issues.md` is the temporary authoritative backlog until the repository feature is enabled and the remaining items are migrated.

### GitHub monitoring not yet merged

Draft PR 69 adds GitHub Status as a high-criticality provider. Keeping it separate prevents provider-catalog changes from obscuring stabilization or architecture-cleanup evidence.

## Completion order

1. Pass Step 2 pull-request checks.
2. Merge Step 2 and pass the full production release gate.
3. Verify two consecutive scheduled releases without freshness-watch interference.
4. Update this status document and `docs/open-issues.md` with the final run IDs.
5. Then rebase and validate the isolated GitHub-monitoring PR against the stabilized architecture.
