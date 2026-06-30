# MSP Status HUD

A free, static GitHub Pages status dashboard for MSPs.

The site is hosted from GitHub Pages and refreshed by GitHub Actions every 5 minutes. It does not use Docker, paid APIs, a database, or a server.

## Live site

https://dmo18.github.io/sst/

## How it works

```text
GitHub Actions, every 5 minutes
  fetches public provider status sources
  normalizes provider states and incident notes
  writes status.json
  commits status.json to main

GitHub Pages
  serves index.html
  index.html reads local status.json
  the browser never fetches vendor feeds directly
```

## Files

```text
index.html                         Static HUD UI
status.json                        Generated status data
config/providers.json              Provider catalog and service filters
scripts/fetch-status.js            Feed fetcher and normalizer
.github/workflows/update-status.yml Scheduled GitHub Actions workflow
CLAUDE.md                          Project guidance for coding agents
```

## Current provider scope

The provider list is configured in `config/providers.json`.

Included providers:

- Microsoft 365
- Entra ID
- AWS
- Cloudflare
- Google Workspace
- Google Cloud
- OpenAI
- Anthropic
- SentinelOne
- Sophos
- DNSFilter
- ConnectWise
- HaloPSA
- NinjaOne
- Cisco Meraki
- Ubiquiti
- Dropbox
- Box
- Wasabi
- Backblaze
- Slack
- Zoom

Some providers publish rich public JSON. Some only publish public HTML or limited public summaries. Microsoft 365 and Entra ID detailed tenant service health require authenticated Microsoft Graph and are intentionally treated as limited public sources in this free version.

## Updating data manually

Go to:

```text
Actions -> Update status -> Run workflow -> main
```

## GitHub Pages setup

Use:

```text
Settings -> Pages -> Deploy from a branch -> main -> / root
```

## Development notes

Run the fetcher locally with Node 20 or newer:

```bash
node scripts/fetch-status.js
```

This writes `status.json`.

## Known limitations

- No paid APIs.
- No Docker.
- No backend server.
- Browser reads only `status.json`.
- GitHub Actions scheduled workflows can be delayed by GitHub.
- Public Microsoft 365 and Entra ID detail is limited without Graph auth.
- Some vendors publish maintenance notices in the same feed as incidents, so filtering is important.
