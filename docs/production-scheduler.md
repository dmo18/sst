# Production scheduler and recovery

## Decision

SST production runs entirely on GitHub-hosted infrastructure:

1. `Deploy ServiceOps Enterprise Workspace` is the normal path. GitHub Actions schedules it at `*/5 * * * *`, the shortest supported GitHub Actions interval, and it deploys the static site to GitHub Pages.
2. `Status Freshness Watch` is an independently scheduled GitHub Actions recovery control at minutes `2,7,12,17,22,27,32,37,42,47,52,57`. It verifies the deployed immutable payload against current official structured truth, defers while a healthy-age release is active, cancels only a wedged release after 12 minutes, and emits one `freshness-recovery` repository dispatch when needed.
3. `Bounded Refresh Continuity` is a renewable GitHub-native five-minute-class heartbeat. A successful scheduled or pushed release starts it, and an offset hourly cron can seed it independently. It checks every 330 seconds, defers while a healthy-age Pages release is active, cancels only a release wedged for 12 minutes, and dispatches a recovery refresh when safe. Each keeper has at most 58 checks (319 minutes) and a 350-minute runner budget. Before expiry it sends an explicit `workflow_dispatch` to hand off to another finite keeper. A newer scheduled deployment replaces the predecessor. Manual `test_mode=true` dispatches once without renewing.
4. Recovery runs the same collection, contract validation, Pages deployment, and production smoke test as a normal refresh. It reuses the commit-keyed verified application shell to avoid unnecessary application compilation.

The watcher, continuity keeper and Pages releases have separate concurrency groups, and only one Pages release may run at a time. No VM, Agent Deck, external scheduler account, secret or persistent backend is involved. The renewal keeper occupies a GitHub-hosted runner while it waits to dispatch each refresh. This is best-effort GitHub-native continuity and must not be represented as a guaranteed freshness SLA.

GitHub documents five minutes as the minimum scheduled interval and notes cron events may be delayed or dropped. On October 26, 2026, nominal `*/5` deployments in this repository arrived more than six hours apart. The former three-dispatch bridge ran only about 17 minutes and allowed the payload to age for several hours. The renewable keeper now drives recovery dispatches at 330-second intervals and hands off before the six-hour runner limit. `workflow_dispatch` is an explicit exception to `GITHUB_TOKEN` event recursion suppression.

## Per-release live coverage reporting

After deployment and production smoke checks pass, each workflow run writes the verified official-source coverage state and description to `GITHUB_STEP_SUMMARY`. Incomplete source coverage produces a workflow warning but does not block deployment of a structurally valid, fail-closed payload. Read the latest release run summary for current coverage, rather than relying on a commit status that may be stale.

Do not post a fresh `status-data/live-coverage` commit status every five minutes: GitHub caps status records per SHA and context, while normal scheduled refreshes reuse the same SHA. The previous behavior exhausted that cap and caused successful Pages deployments to be reported as failed. The deployment job therefore has no `statuses: write` permission. Independent source-health and deployment conclusions must remain distinct.
## Hard availability boundary

This is an improvement, not a guarantee. Each heartbeat generation is finite, but one generation intentionally starts the next using `workflow_dispatch`; the heartbeat is continuously active when GitHub is healthy. Handoff can fail when the API, Actions queue, permission, GitHub runner or Pages deployment service is unavailable. Independent hourly GitHub schedule, `*/5` schedule and status watcher can restart it once GitHub scheduling resumes, but all share the same failure domain. A hard maximum snapshot age needs an independently operated scheduler, freshness alerting and platform authorization. Never hide, relabel or fabricate old vendor data: the dashboard's 20-minute stale warning remains essential.

## Security audit — 2026-09-02

- Hosting is public GitHub Pages with HTTPS enforced and workflow-based builds; SST has no runtime backend, database, deployed secrets, or browser-side vendor credentials.
- Repository Actions secrets: none. Repository Actions variables: none.
- Collection explicitly removes `GITHUB_TOKEN` and `GH_TOKEN`; public vendor collection cannot receive deployment credentials.
- All third-party Actions are pinned to full commit SHAs and every checkout uses `persist-credentials: false`.
- The normal build is `contents: read` plus `actions: read` for its verified shell artifact. Only the deploy job has `pages: write` and `id-token: write`; recurring releases do not need `statuses: write`. Each release reports its live-source coverage state in that run's summary instead of posting repeat statuses to the unchanged commit.
- The recovery watcher and bounded bridge receive short-lived `GITHUB_TOKEN` permissions only: `contents: write` for their `repository_dispatch` API calls and `actions: write` to cancel a demonstrably wedged Pages run. They have no repository secret or long-lived personal token.
- GitHub secret scanning and push protection are enabled. Branch protection is not configured, so administrator review of changes to production workflow permissions remains an operational follow-up.

## Cost audit — 2026-09-02

The repository is public and uses standard `ubuntu-latest` GitHub-hosted runners. GitHub states that standard runner usage is free for public repositories, so the five-minute refresh and offset recovery control add no runner-minute charge. No paid VM, database, queue, or scheduler remains.

The residual metered surface is retained Actions artifact storage. At audit time, active artifacts totalled about 39 MB and caches about 311 MB. Current retention is intentionally bounded: Pages artifacts one day, wallboard evidence seven days, product evidence 14 days, and verified shells 30 days. Keep an eye on artifact storage if the repository becomes private or evidence size grows.

## Verification procedure

1. Confirm no `sst-freshness-watchdog` user timer or service exists on the former VM.
2. Dispatch `Bounded Refresh Continuity` with its default test mode. It must emit exactly one recovery dispatch without waiting, then stop. For sustained operation confirm a non-test keeper started from push/schedule or an hourly seed.
3. Confirm the dispatched recovery run succeeds and production `deploy-version.txt` selects its immutable `status-<run>.json`.
4. Confirm a pushed or scheduled deployment starts/replaces the keeper. Inspect two successive 330-second recovery dispatches and their published `generated_at` values, then verify a single `workflow_dispatch` handoff at the keeper's 58th check.
5. Inspect the release run summary for the live official-source coverage result and confirm incomplete coverage yields a warning without failing a valid deployment.
6. Confirm that pull request checks pass `npm audit --audit-level=high` and both CodeQL steps use the same pinned release.

## Sources

- [GitHub Actions scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [Triggering a workflow from another workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
