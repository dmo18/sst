# CLAUDE.md

Guidance for coding agents working on this repository.

## Goal

Build a free static MSP status aggregator hosted on GitHub Pages.

## Constraints

- No Docker.
- No server runtime.
- No database.
- No paid APIs.
- No browser side vendor feed calls.
- No synthetic monitoring.
- No third party outage scraping.
- Keep GitHub Pages static hosting.

## V2 files

```text
config/providers.json       single provider catalog
scripts/validate-providers.mjs catalog validator
scripts/update-status.mjs   official source fetcher
scripts/build.mjs           release build wrapper
public/status.json          generated during build and not committed
src/App.tsx                 React app with catalog fallback
src/statusViewModel.ts      merges catalog and generated status
src/IssueConsole.tsx        incident and diagnostics UI
.github/workflows/refresh-pages.yml deploy workflow
```

## UI rules

```text
Incident panel shows active issues only.
Diagnostic panel shows every configured provider. Diagnostics must cover all 90 providers in config/providers.json.
Limited, failed, pending, and catalog only providers must still be visible.
```

Diagnostic rows should show provider, category, status, parser, checked time, source URL, fetch timing, HTTP status, and any error.

## Feed rules

Use only source type names implemented by `scripts/update-status.mjs`:

```text
statuspage                    official Statuspage summary API
rss                           official RSS feed
google-cloud-incidents        official Google Cloud incidents JSON
google-workspace-incidents    official Google Workspace incidents JSON
salesforce-active-incidents   official Salesforce active incidents API
slack-current-status          official Slack current status API
heroku-current-status         official Heroku current status API
connectwise-html              official ConnectWise public status HTML
backblaze-html                official Backblaze public status HTML
quickbooks-html               official QuickBooks public status HTML
limited-official              official source limited by account, location, login, tenant, bot filtering, or missing public detail
limited-public-page           official public page limited by account, location, login, tenant, bot filtering, or missing public detail
official-limited              official source limited by account, location, login, tenant, bot filtering, or missing public detail
limited-microsoft             public Microsoft source with limited detail; Graph tenant access is required for reliable service-health data
html-limited                  official HTML source limited by account, location, login, tenant, bot filtering, or missing public detail
okta-html                     official Okta public status page treated as a limited public page
```

Limited providers are intentionally blue because the source is reachable or cataloged but cannot reliably provide unauthenticated, customer-specific, or machine-readable outage state. Do not turn limited providers red/yellow from pings, routes, unofficial outage reports, third party pages, or synthetic probes.

Do not create incidents from pings, routes, unofficial outage reports, or synthetic probes.

## Noise filtering

Filter resolved incidents, completed maintenance, old RSS items, deprecations, lifecycle notices, informational notices, and maintenance with no customer impact.

Show active incidents, degraded availability, service disruption, authentication failures, email failures, MSP platform failures, DNS impact, network impact, and security tool outages.

## Commands

```bash
npm run validate-providers
npm run update-status
npm run build
npm test
```

`npm run build` validates providers, generates public/status.json without committing it, checks TypeScript, and builds the Vite artifact. Generated status files such as public/status.json are build outputs and must not be committed.

## Do not reintroduce v1 artifacts

Do not reintroduce Playwright browser scraping, HUD overlays, or fetch-status workflows. The v2 implementation uses the provider catalog, `scripts/update-status.mjs`, generated status JSON, and the static Vite build only.

## Deployment

```text
Settings -> Pages -> Source -> GitHub Actions
.github/workflows/refresh-pages.yml deploys the static dist artifact
```
