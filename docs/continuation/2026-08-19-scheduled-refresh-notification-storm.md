# Scheduled refresh notification storm

Status: fix in progress
Date: 2026-08-19
Repository: `dmo18/sst`

## Symptom

The repository owner received repeated GitHub Actions failure emails for `Deploy ServiceOps Enterprise Workspace` on `main` even when no one was actively changing the repository.

The workflow was schedule-driven, so inactivity by a human did not mean inactivity in Actions. Before this fix it ran at minutes `7,19,31,43,55` of every hour and each scheduled poll exercised much of the same deployment and browser-verification path as a full release.

The status monitor is required to poll every five minutes. Reducing the monitoring cadence is not an acceptable fix.

## What is proven

The accepted main release `31642782743` on commit `007d00e57c5293fcf586e460084ba7c2f714da45` completed both build and deploy jobs successfully.

That successful run published `status-data/live-coverage` as failure because the payload had `79/80 live (99%); quality 85; 1 blind`. Therefore a red live-coverage commit status is not, by itself, the cause of the `Run failed` emails. The workflow can complete successfully while truthfully reporting incomplete provider coverage.

The scheduled path also performed Pages deployment, production smoke, headless Chrome rendering, Yodeck verification, and artifact upload on every poll. Those release-certification steps add failure surface that is unrelated to the core job of a frequent status refresh.

The exact failing step from the August 17 and August 18 email runs could not be retrieved in the current connector session because the available GitHub Actions connector can inspect a known run ID but cannot enumerate the recent schedule-triggered workflow runs. Gmail access was not authorized, so the email links could not be used to recover those run IDs. Do not claim a specific recent failing step without direct run evidence.

## Fix contract

The scheduled monitor must:

- run every five minutes using `*/5 * * * *`
- collect current public provider status
- validate the provider catalog and browser payload
- verify the release/data contract
- reuse or build the verified application shell
- deploy the refreshed status payload
- smoke-test the deployed assets and payload
- publish `status-data/live-coverage`

It must not run full browser and wallboard release certification every five minutes. Those checks remain strict for push/manual releases.

Pages deployment is retried up to three times with bounded backoff so a transient deployment-service failure does not immediately turn one poll into a failed workflow. The final attempt remains strict. The workflow jobs themselves do not use `continue-on-error`, and collection, validation, and production smoke remain failure-producing when genuinely broken.

## Implementation branch

`fix/scheduled-refresh-notification-storm-2026-08-18`

Primary workflow changes:

- schedule changed to `*/5 * * * *`
- Pages deployment now has three bounded attempts with 20-second and 40-second backoff
- production smoke propagation window increased to ten attempts with ten-second waits
- headless Chrome workspace rendering is release-only
- legacy Chromium verification remains release-only
- 458x291 Yodeck verification and its artifact upload are release-only
- scheduled collection, payload validation, deployment smoke, and live-coverage publication remain strict

Regression coverage is in `scripts/__tests__/scheduled-refresh-workflow.test.js`.

## Acceptance criteria

Before closing this record:

1. PR checks pass, including the new workflow regression test.
2. The fix merges to `main` through the normal review/CI path.
3. The post-merge release succeeds.
4. At least one five-minute scheduled refresh is observed succeeding on the merged workflow when a run ID becomes available.
5. If a scheduled run fails, inspect its exact failing job/step before making any further reliability changes.

Do not suppress GitHub notifications as a substitute for fixing workflow failures.
