# MSP Status Dashboard v2

Static GitHub Pages status aggregator for MSP wallboards.

Live site: https://dmo18.github.io/sst/

## Version

```text
App: v2.1.4
Package: 2.1.4
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
Build generates public/status.json during the build.
public/status.json is generated and not committed.
Pages deploys the generated static artifact.
Browser reads status.json from the deployed site artifact.
Browser does not call vendor status feeds directly.
Incident view shows active issues only.
Diagnostics show every configured provider.
Exactly 90 approved providers are configured.
Limited providers render blue with reasons.
No synthetic or unofficial outage scraping is used.
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
google-cloud-incidents
google-workspace-incidents
salesforce-active-incidents
slack-current-status
heroku-current-status
connectwise-html
backblaze-html
quickbooks-html
limited-official
limited-public-page
official-limited
limited-microsoft
html-limited
okta-html
```

## Limits

```text
No Docker.
No backend server.
No database.
No paid APIs.
No synthetic monitoring.
No synthetic or unofficial outage scraping.
No third party outage scraping.
Microsoft 365 tenant details require authenticated Graph and are limited in this free public build.
```
