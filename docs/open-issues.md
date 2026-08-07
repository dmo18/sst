# Open issues and stabilization register

Last reviewed: 2026-08-06

This file is the temporary authoritative backlog because GitHub Issues is disabled for this repository. After Issues is enabled in repository settings, each remaining open item should become a GitHub issue and this file should link to those records.

## Step 1 production stabilization

### Completed in source and controlled production release

- [x] Serialize every Pages release under one `pages-release` concurrency group.
- [x] Disable in-progress release cancellation.
- [x] Remove the superseded Pages deployment cancellation step.
- [x] Run deterministic tests, TypeScript checking, production dependency audit, live collection, payload validation, production build, deployment, smoke checks, and browser rendering for every release event, including schedules.
- [x] Prevent freshness recovery from dispatching while a release is queued or active.
- [x] Keep unattended vertical and horizontal wallboard marquees running when content overflows, including on a display that reports reduced motion.
- [x] Apply the `alerts=36h` window to both incident rows and the provider rail.
- [x] Replace unreliable Chrome `--window-size` verification with Chrome DevTools device metrics at an actual 458 by 291 CSS viewport.
- [x] Verify compact geometry, overlay separation, page overflow, freshness telemetry, alert-window filtering, and marquee state in the deployed browser.
- [x] Upload exact Yodeck DOM and screenshot evidence.
- [x] Complete one controlled production release through every build and deployment gate.

Controlled proof: workflow run `31137204360` deployed commit `428b231f454a9df65687da51b0c4b3aeb6eb2545` successfully.

### Completion evidence still required

- [ ] Two consecutive scheduled releases complete successfully without cancellation or freshness-recovery interference.
- [ ] GitHub Issues is enabled and this backlog is migrated into issue records.

## Step 2 architecture cleanup

### Completed on the isolated Step 2 branch

- [x] Remove `src/Wallboard.tsx`, the unused legacy wallboard component.
- [x] Remove `src/wallboard.ts` and its obsolete rotation, pagination, and legacy settings contract.
- [x] Remove `src/wallboardDomEnhancements.ts` and move header state, overlay controls, and freshness telemetry into React.
- [x] Remove `src/styles/wallboard-focus.css` and consolidate dedicated wallboard styling into `src/styles/wallboard-v2.css`.
- [x] Keep shared application tokens and generic base primitives in `command-center.css` without restoring a second wallboard controller.
- [x] Remove the stale checked-in `public/deploy-version.txt` marker.
- [x] Generate deployment identity during `npm run build:app` from `GITHUB_SHA`, `GITHUB_RUN_ID`, and generation time.
- [x] Verify the deployed commit and run identity during production smoke testing.
- [x] Add regression contracts preventing the legacy component, imperative controller, split wallboard stylesheet, and checked-in deployment marker from returning.
- [x] Update current architecture and operator documentation.

### Step 2 completion evidence still required

- [ ] Step 2 pull-request checks pass.
- [ ] Step 2 is merged without unrelated feature changes.
- [ ] The merged Step 2 revision completes the full Pages release path.
- [ ] Production smoke verifies the generated release identity against the merged SHA and workflow run ID.
- [ ] Exact 458 by 291 Yodeck verification remains green after the React ownership cleanup.

## Remaining engineering issues

### High priority

1. **Prove deployment reliability over consecutive schedules.**
   - Completion: two consecutive scheduled releases pass the full pipeline and publish fresh data without cancellation.
2. **Confirm freshness recovery remains noninterfering.**
   - Completion: freshness-watch reports current data or defers while a release is active, without cancelling or duplicating a release.
3. **Complete Step 2 production validation.**
   - Completion: Step 2 PR checks, merge release, production identity verification, normal browser render, and exact Yodeck verification all pass.

### Administrative

4. **Enable GitHub Issues.**
   - Repository setting: Settings, General, Features, Issues.
5. **Migrate this register into GitHub Issues.**
   - Create one issue per remaining item, assign priority and owner, add acceptance criteria, and link production evidence before closure.

## Deferred provider addition

Draft PR 69 adds GitHub itself as a monitored high-criticality DevOps provider through the official GitHub Status API. It remains separate from Step 2 so provider-catalog changes are not mixed with deployment stabilization and architecture cleanup.

## Change control

Until the two scheduled-release proof points and Step 2 production validation are complete, keep changes narrowly scoped to stabilization, architecture cleanup, documentation, or the already isolated GitHub-monitoring provider PR. Do not create retry commits or competing deployment workflows.
