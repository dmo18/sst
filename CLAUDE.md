# CLAUDE.md

Guidance for coding agents working on this repository.

## Goal

Build a free static MSP status aggregator hosted on GitHub Pages.

## Constraints

- Keep GitHub Pages static hosting.
- No Docker.
- No server runtime.
- No database.
- No paid APIs.
- No browser-side vendor feed calls.
- No synthetic monitoring, pings, route checks, DNS tests, or network probes.
- No third-party outage sites.
- No social scraping.
- No unofficial sources.

## V2 architecture files

```text
config/providers.json          canonical approved provider catalog
scripts/validate-providers.mjs catalog validator
scripts/update-status.mjs      official-source parser and status generator
scripts/build.mjs              release build wrapper
public/status.json             generated during build, ignored by Git, never committed
src/App.tsx                    static browser shell that fetches generated status.json only
src/statusViewModel.ts         merges catalog and generated status so diagnostics stay complete
src/IssueConsole.tsx           active incident and diagnostics UI
```

## Status generation contract

```text
Build validates config/providers.json.
Build generates public/status.json.
Generated status files are ignored and must not be committed.
The browser reads only the generated static status.json served by the deployed site.
The browser must not call vendor feeds, vendor APIs, RSS feeds, HTML pages, or other official sources directly.
```

## UI rules

```text
Active incident view shows only active impacting incidents.
Diagnostics always render every approved provider from config/providers.json.
Limited, failed, pending, and catalog-only providers must remain visible in diagnostics.
Limited official sources render blue and must include a precise reason explaining the limitation.
```

Diagnostic rows should show provider, category, status, parser/source type, checked time, source URL, fetch timing, HTTP status, messages, and any error.

## Parser source types

```text
statuspage                 official Statuspage summary API
rss                        official RSS feed; parser applies max-age filtering to avoid stale incidents
google-cloud-incidents     official Google Cloud incidents JSON
slack-current-status       official Slack current status API
heroku-current-status      official Heroku current status API
limited-microsoft          official Microsoft source with tenant-scoped limited detail
limited-public-page        official public page limited by account, region, login, location, or bot filtering
official-limited           approved official source listed but not reliably machine-readable
html-limited               approved official HTML source treated as limited when not reliably machine-readable
okta-html                  approved official Okta HTML source treated as limited when not reliably machine-readable
```

## Incident filtering

Filter resolved incidents, completed maintenance, old RSS items outside parser max age, deprecations, lifecycle notices, informational notices, and maintenance with no customer impact.

Show only active impacting incidents such as degraded availability, service disruption, authentication failures, email failures, MSP platform failures, DNS impact reported by an approved official source, network impact reported by an approved official source, and security tool outages.

Do not create incidents from synthetic monitoring, pings, route checks, DNS tests, third-party outage sites, social posts, unofficial reports, or browser-side checks.

## Commands

```bash
npm run validate-providers
npm run update-status
npm run build
npm test
```

`npm run build` validates providers, generates `public/status.json`, checks TypeScript, and builds the Vite artifact.

## Deployment

Use the GitHub Pages Actions deployment for the static Vite artifact. The deployed artifact includes generated `status.json`; source-control commits do not include generated status data.
