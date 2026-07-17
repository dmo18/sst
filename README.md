# MSP Status Dashboard v2

Static GitHub Pages status aggregator for MSP wallboards.

Live site: https://dmo18.github.io/sst/

## Version

```text
App: v2.1.2
Package: 2.1.2
```

## Architecture

```text
config/providers.json          approved 90-provider catalog
scripts/validate-providers.mjs strict provider catalog validator
scripts/update-status.mjs      official-source status generator
scripts/build.mjs              validation, status generation, TypeScript, Vite
src/App.tsx                    React app with catalog fallback
src/statusViewModel.ts         merges catalog and generated status
src/IssueConsole.tsx           incident and diagnostics UI
.github/workflows/refresh-pages.yml  Pages build and deploy
```

## Contract

```text
Build validates the provider catalog and requires exactly 90 approved providers.
Build generates public/status.json.
Generated status files are ignored and are not committed.
Pages deploys the generated static artifact.
Browser reads status.json from the deployed site.
Browser does not call vendor status feeds directly.
Incident view shows active impacting issues only.
Diagnostics show every configured provider with fetch and parser details.
Limited official sources are blue and include the limitation reason.
```

## Commands

```bash
npm install
npm run validate-providers
npm run update-status
npm run build
npm test
```

## Provider source types

```text
statuspage              official Statuspage summary API
rss                     official RSS feed with active/noise/max-age filtering
google-cloud-incidents  official Google Cloud incidents JSON
slack-current-status    official Slack current status API
heroku-current-status   official Heroku current-status API
limited-public-page     official public page or lookup with no stable unauthenticated aggregate feed
official-limited        official source listed but not reliably machine-readable
limited-microsoft       Microsoft public endpoint plus tenant-scoped Graph limitation
```

## Limits

```text
No Docker.
No backend server.
No database.
No paid APIs.
No secrets required.
No synthetic monitoring.
No pings, traceroutes, DNS tests, or route monitoring.
No third-party outage scraping.
No social media scraping.
No unofficial incident inference.
Microsoft 365 and Entra tenant details require authenticated Graph service communications for reliable rich detail.
```
