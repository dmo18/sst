# Production scheduler and recovery

## Decision

SST production runs entirely on GitHub-hosted infrastructure:

1. `Deploy ServiceOps Enterprise Workspace` is the normal path. GitHub Actions schedules it at `*/5 * * * *`, the shortest supported GitHub Actions interval, and it deploys the static site to GitHub Pages.
2. `Status Freshness Watch` is an independently scheduled GitHub Actions recovery control at minutes `2,7,12,17,22,27,32,37,42,47,52,57`. It verifies the deployed immutable payload against current official structured truth, defers while a healthy-age release is active, cancels only a wedged release after 12 minutes, and emits one `freshness-recovery` repository dispatch when needed.
3. Recovery runs the same collection, contract validation, Pages deployment, and production smoke test as a normal refresh. It reuses the commit-keyed verified application shell to avoid unnecessary application compilation.

The two workflows are serialized by separate watcher and Pages-release concurrency groups. No VM process, Agent Deck service, cron job, credential, or persistent backend is part of correctness, freshness, recovery, deployment, or availability. Agent Deck may observe repository state but is not a production control plane.

GitHub documents five minutes as the minimum schedule interval and notes that scheduled jobs may be delayed or dropped under high load. The offset watcher is therefore retained as a GitHub-native recovery control rather than moving the normal path to a VM or another paid scheduler. A GitHub Actions outage necessarily also prevents the GitHub Pages deployment it would recover, so an external VM does not improve the relevant failure domain.

## Security audit — 2026-09-02

- Hosting is public GitHub Pages with HTTPS enforced and workflow-based builds; SST has no runtime backend, database, deployed secrets, or browser-side vendor credentials.
- Repository Actions secrets: none. Repository Actions variables: none.
- Collection explicitly removes `GITHUB_TOKEN` and `GH_TOKEN`; public vendor collection cannot receive deployment credentials.
- All third-party Actions are pinned to full commit SHAs and every checkout uses `persist-credentials: false`.
- The normal build is `contents: read` plus `actions: read` for its verified shell artifact. Only the deploy job has `pages: write`, `id-token: write`, and `statuses: write`.
- The recovery watcher receives short-lived `GITHUB_TOKEN` permissions only: `contents: write` for its `repository_dispatch` API call and `actions: write` to cancel a demonstrably wedged Pages run. It has no repository secret or long-lived personal token.
- GitHub secret scanning and push protection are enabled. Branch protection is not configured, so administrator review of changes to production workflow permissions remains an operational follow-up.

## Cost audit — 2026-09-02

The repository is public and uses standard `ubuntu-latest` GitHub-hosted runners. GitHub states that standard runner usage is free for public repositories, so the five-minute refresh and offset recovery control add no runner-minute charge. No paid VM, database, queue, or scheduler remains.

The residual metered surface is retained Actions artifact storage. At audit time, active artifacts totalled about 39 MB and caches about 311 MB. Current retention is intentionally bounded: Pages artifacts one day, wallboard evidence seven days, product evidence 14 days, and verified shells 30 days. Keep an eye on artifact storage if the repository becomes private or evidence size grows.

## Verification procedure

1. Confirm no `sst-freshness-watchdog` user timer or service exists on the former VM.
2. Dispatch `Status Freshness Watch` from GitHub Actions and confirm it succeeds without a VM process.
3. Confirm a scheduled `*/5` deployment succeeds, then read deployed `deploy-version.txt` and its selected immutable `status-<run>.json`.
4. Confirm production smoke reports the current generated timestamp and Status Contract v3.

## Sources

- [GitHub Actions scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
