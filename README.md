# MSP Status Dashboard v2

Static GitHub Pages status aggregator for MSP wallboards.

Live site: https://dmo18.github.io/sst/

## Version

```text
App: v2.1.0
Package: 2.1.0
```

## Architecture

```text
config/providers.json        single provider catalog
scripts/validate-providers.mjs provider catalog validator
scripts/update-status.mjs    status source fetcher
scripts/build.mjs            validation, status generation, TypeScript, Vite
src/App.tsx                  React app with catalog fallback
.github/workflows/refresh-pages.yml  Pages build and deploy
.github/workflows/test.yml   pull request build check
```

## Contract

```text
Build validates provider catalog.
Build generates public/status.json.
Pages deploys the generated static artifact.
Browser reads status.json from the deployed site.
Browser does not call vendor status feeds directly.
Incident view shows active issues only.
Diagnostics show every configured provider.
```

## Commands

```bash
npm run validate-providers
npm run update-status
npm run build
npm test
```

## Provider source types

```text
statuspage
rss
google-cloud-json
slack
okta-html
html-limited
official-limited
limited-microsoft
```

## Limits

```text
No Docker.
No backend server.
No database.
No paid APIs.
No synthetic monitoring.
No third party outage scraping.
Microsoft 365 tenant details require authenticated Graph and are limited in this free public build.
```
