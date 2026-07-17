# CLAUDE.md

Guidance for coding agents working on this repository.

## Goal

Build a free static MSP status aggregator hosted on GitHub Pages.

## Constraints

- No Docker.
- No server runtime.
- No database.
- No paid APIs.
- No secrets required.
- No browser-side vendor feed calls.
- No synthetic monitoring.
- No pings, traceroutes, DNS tests, route monitoring, or third-party outage scraping.
- Use official provider sources only.
- Keep GitHub Pages static hosting.

## V2 files

```text
config/providers.json          approved 90-provider catalog
scripts/validate-providers.mjs strict catalog validator
scripts/update-status.mjs      official source fetcher and parser registry
scripts/build.mjs              release build wrapper
public/status.json             generated during build, ignored by git
src/App.tsx                    React app with catalog fallback
src/statusViewModel.ts         merges catalog and generated status
src/IssueConsole.tsx           incident and diagnostics UI
.github/workflows/refresh-pages.yml deploy workflow
```

## UI rules

```text
Incident panel shows active impacting issues only.
Diagnostic panel shows every configured provider.
Limited, failed, pending, and catalog-only providers must still be visible.
```

Diagnostic rows should show provider, category, status, source URL, source type/parser, checked time, fetch start, fetch completion, duration, HTTP/fetch status, parser result, message, and any error.

## Feed rules

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

Do not create incidents from pings, routes, unofficial outage reports, synthetic probes, marketing pages, or social media.

## Noise filtering

Filter resolved incidents, completed maintenance, old RSS items, deprecations, lifecycle notices, informational notices, and maintenance with no customer impact. AWS RSS uses a default 72-hour max age unless the provider config sets `maxAgeHours`.

Show active incidents, degraded availability, service disruption, authentication failures, email failures, MSP platform failures, DNS impact, network impact, and security tool outages.

## Commands

```bash
npm install
npm run validate-providers
npm run update-status
npm run build
npm test
```

`npm run build` validates providers, generates `public/status.json`, checks TypeScript, and builds the Vite artifact. Generated status files must not be committed.

## Deployment

```text
Settings -> Pages -> Source -> GitHub Actions
.github/workflows/refresh-pages.yml
```
