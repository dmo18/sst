# Open issues and stabilization register

Last reviewed: 2026-08-06

This file is the temporary authoritative backlog because GitHub Issues is disabled for this repository. After Issues is enabled in repository settings, each open item below should become a GitHub issue and this file should link to those records.

## Step 1 production stabilization

### Completed in source

- [x] Serialize every Pages release under one `pages-release` concurrency group.
- [x] Disable in-progress release cancellation.
- [x] Remove the superseded Pages deployment cancellation step.
- [x] Run deterministic tests, TypeScript checking, production dependency audit, live collection, payload validation, production build, deployment, smoke checks, and browser rendering for every release event, including schedules.
- [x] Prevent freshness recovery from dispatching while a release is queued or active.
- [x] Keep unattended vertical and horizontal wallboard marquees running when content overflows, including on a display that reports reduced motion.
- [x] Add exact 458 by 291 Yodeck production verification.
- [x] Verify the 36-hour alert cutoff, compact geometry, overlay separation, page overflow, telemetry, and marquee state in the deployed browser.
- [x] Upload the exact Yodeck DOM and screenshot as release evidence.

### Completion evidence still required

- [ ] One controlled production release completes all build, deploy, smoke, browser, and Yodeck checks.
- [ ] Two consecutive scheduled releases complete successfully without cancellation or freshness-recovery interference.
- [ ] GitHub Issues is enabled and this backlog is migrated into issue records.

## Remaining engineering issues

### High priority

1. **Prove deployment reliability over consecutive schedules.**
   - Completion: two consecutive scheduled releases pass the full pipeline and publish fresh data.
2. **Prove the 458 by 291 Yodeck contract in production.**
   - Completion: the release probe reports `data-layout-probe="pass"` and uploads a nonempty screenshot and DOM artifact.
3. **Confirm freshness recovery remains noninterfering.**
   - Completion: a freshness-watch run either reports current data or defers while a release is active, without cancelling or duplicating a release.

### Medium priority

4. **Remove the legacy wallboard implementation.**
   - `src/Wallboard.tsx` remains tracked while `src/WallboardV2.tsx` is active.
5. **Consolidate wallboard style ownership.**
   - Wallboard behavior is split among `command-center.css`, `wallboard-focus.css`, and `wallboard-v2.css`.
6. **Move structural overlay and telemetry behavior fully into React.**
   - `wallboardDomEnhancements.ts` still owns header mode and freshness telemetry injection.
7. **Replace the stale checked-in deployment marker.**
   - `public/deploy-version.txt` should be generated from the release SHA or removed.
8. **Keep system status documentation synchronized with verified production state.**
   - `docs/system-status.md` should be updated after the Step 1 release evidence is complete.

### Administrative

9. **Enable GitHub Issues.**
   - Repository setting: Settings, General, Features, Issues.
10. **Migrate this register into GitHub Issues.**
   - Create one issue per item, assign priority and owner, add acceptance criteria, and link production evidence before closure.

## Change control

Until the Step 1 completion evidence is satisfied, unrelated wallboard feature work is frozen. Only a narrowly scoped correction for a failing release acceptance check may be merged.
