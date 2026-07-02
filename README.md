# MSP Status Dashboard

A free, static GitHub Pages status aggregator for MSP wallboards.

The product aggregates official provider status sources only. It is not a synthetic monitor, uptime checker, route monitor, ISP probe, or third-party outage scraper.

## Live site

https://dmo18.github.io/sst/

## Current app

The UI is now a React and Vite dashboard instead of a tiny fixed HUD. It is designed to show the whole operating picture clearly:

```text
Top summary
  overall state, active incident count, operational count, limited-source count

Priority strip
  Microsoft 365, Entra ID, Cloudflare, AWS, Google Workspace, OpenAI

Active issues
  full incident title, provider, time, status, source, and detail note

Priority watch
  all providers sorted by severity and priority

Provider matrix
  every configured source grouped by category
```

## Contract

```text
GitHub Actions, every 5 minutes
  fetches official public provider status sources
  normalizes provider states and active incident notes
  writes status.json and public/status.json
  commits status data to main

GitHub Pages
  deploys the Vite React static app
  browser reads generated status.json
  browser does not fetch vendor feeds directly
```

## Files

```text
index.html                            Vite HTML entry
src/main.tsx                          React entrypoint
src/App.tsx                           Dashboard app and components
src/styles/app.css                    Dashboard visual system
config/providers.json                 Official status source catalog
scripts/fetch-status.cjs              Status fetcher and normalizer
status.json                           Generated status data at repo root
public/status.json                    Generated status data for Vite public assets
.github/workflows/update-status.yml   Scheduled status-data updater
.github/workflows/pages-vite.yml      Vite GitHub Pages deployment
.github/workflows/test.yml            Build and Playwright render tests
CLAUDE.md                             Project guidance for coding agents
```

## Current provider scope

The provider list is configured in `config/providers.json`.

```text
Microsoft 365
Entra ID
AWS
Cloudflare
Google Workspace
Google Cloud
OpenAI
Anthropic
SentinelOne
Sophos
DNSFilter
ConnectWise
HaloPSA
NinjaOne
Cisco Meraki
Ubiquiti
Akamai
Fastly
GitHub
DigitalOcean
Atlassian
Okta
PagerDuty
Zscaler
Quad9
AT&T
Cox
Comcast Business
Lumen
Dropbox
Box
Wasabi
Backblaze
Slack
Zoom
```

Some providers publish rich public JSON. Some only publish public HTML or limited public summaries. Microsoft 365 and Entra ID detailed tenant service health require authenticated Microsoft Graph and are intentionally treated as limited public sources in this free version.

## Source types

```text
statuspage
  Official Atlassian Statuspage summary API.

rss
  Official provider RSS feed.

google-cloud-json
  Official Google Cloud incidents JSON feed.

slack
  Official Slack status API.

okta-html
  Official Okta public status page parser.

html-limited
  Official public status page is reachable, but no active incident parser is available yet.

official-limited
  Official source is known but not reliably readable from GitHub Actions.

limited-microsoft
  Public Microsoft endpoint is limited. Rich service-health data needs Graph auth.
```

The fetcher must not create incidents from synthetic probes, route lookups, DNS tests, pings, traceroutes, or unofficial outage reports.

## Updating data manually

Go to:

```text
Actions -> Update status -> Run workflow -> main
```

## GitHub Pages setup

Use:

```text
Settings -> Pages -> Source -> GitHub Actions
```

## Development notes

Run the fetcher locally with Node 20 or newer:

```bash
npm run update-status
```

Run the build and render tests:

```bash
npm test
```

## Known limitations

- No paid APIs.
- No Docker.
- No backend server.
- No synthetic monitoring.
- No third-party outage scraping.
- Browser reads generated `status.json` only.
- GitHub Actions scheduled workflows can be delayed by GitHub.
- Public Microsoft 365 and Entra ID detail is limited without Graph auth.
- Some vendors publish maintenance notices in the same feed as incidents, so filtering is important.
