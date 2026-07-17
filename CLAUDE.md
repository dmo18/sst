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
Diagnostic panel shows every configured provider.
Limited, failed, pending, and catalog only providers must still be visible.
```

Diagnostic rows should show provider, category, status, parser, checked time, source URL, fetch timing, HTTP status, and any error.

## Feed rules

```text
statuspage          official Statuspage summary API
rss                 official RSS feed
google-cloud-json   official Google Cloud incidents JSON
slack               official Slack status API
okta-html           official Okta public status page
html-limited        reachable public HTML page
official-limited    official source listed but not reliably readable
limited-microsoft   public Microsoft source with limited detail
```

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

`npm run build` validates providers, generates public/status.json without committing it, checks TypeScript, and builds the Vite artifact.

## Deployment

```text
Settings -> Pages -> Source -> GitHub Actions
.github/workflows/refresh-pages.yml
```
