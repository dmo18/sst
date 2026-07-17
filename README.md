# MSP Status Dashboard v2

Static GitHub Pages status aggregator for MSP wallboards.

Live site: https://dmo18.github.io/sst/

## Version

```text
App: v2.1.2
Package: 2.1.2
```

## Maintainer directions

```text
Bump both package and displayed app versions with every repository change.
Keep README.md, package.json, and src/App.tsx versions in sync.
Commit every completed change on the current branch.
Prepare pull request metadata after each commit.
Push and merge automatically when a git remote, branch policy, and credentials are available; otherwise report that repository configuration blocks push/merge.
```

## Architecture

```text
config/providers.json          canonical provider catalog
scripts/validate-providers.mjs catalog validator
scripts/update-status.mjs      official-source parser and status generator
scripts/build.mjs              validation, status generation, TypeScript, Vite
public/status.json             generated build artifact, ignored by Git
src/App.tsx                    browser shell that fetches generated status.json
src/statusViewModel.ts         catalog/status merge for diagnostics
src/IssueConsole.tsx           active incident and diagnostics UI
```

## V2 status-data flow

```text
Build validates the provider catalog.
Build generates public/status.json before Vite bundles the static site.
Generated status files are ignored and must not be committed.
The deployed browser reads only the generated static status.json from the site.
The deployed browser does not call vendor feeds, vendor APIs, RSS feeds, HTML pages, or other official sources directly.
```

## UI contract

```text
Active incident view shows only active impacting incidents.
Resolved incidents, completed maintenance, lifecycle notices, informational notices, and non-impacting maintenance are filtered out.
Diagnostics always render every approved provider from the catalog.
Catalog-only, pending, failed, and limited official sources remain visible in diagnostics.
Limited official sources are blue and include the precise reason the source is limited.
```

## Provider parser source types

```text
statuspage                 official Statuspage summary API
rss                        official RSS feed with parser max-age filtering
google-cloud-incidents     official Google Cloud incidents JSON
slack-current-status       official Slack current status API
heroku-current-status      official Heroku current status API
limited-microsoft          official Microsoft source with tenant-scoped limited detail
limited-public-page        official public page that is account, region, login, location, or bot-filter limited
official-limited           approved official source that is listed but not reliably machine-readable
html-limited               approved official HTML source treated as limited when not reliably machine-readable
okta-html                  approved official Okta HTML source treated as limited when not reliably machine-readable
```

## Source boundaries

```text
Use only approved official provider sources from config/providers.json.
No synthetic monitoring.
No pings.
No route checks.
No DNS tests.
No third-party outage sites.
No social scraping.
No unofficial sources.
No browser-side vendor feed calls.
```

## Commands

```bash
npm run validate-providers
npm run update-status
npm run build
npm test
```

## Limits

```text
No Docker.
No backend server.
No database.
No paid APIs.
Microsoft 365 and Entra details require tenant-authenticated Graph/service-health data and are limited in this free public build.
```
