# MSP Status Dashboard

A static, official-source-only service-status dashboard for MSP operations teams. The live GitHub Pages site is **https://dmo18.github.io/sst/**.

## How it works

`config/providers.json` is the canonical 90-provider catalog. During deployment, `scripts/update-status.mjs` fetches official APIs, feeds, or explicitly limited official pages with timeouts and bounded concurrency, normalizes the results, validates them, and atomically generates uncommitted `public/status.json`. Vite bundles the React UI; the browser only polls that deployed JSON and never calls vendors.

```text
providers.json -> validate-providers -> update-status -> public/status.json
package.json ------------------------------------------> Vite/React -> dist -> Pages
```

Provider **service health** is separate from **source health**. Red means a major active incident; amber means degraded service; green means an official source confirmed operational; blue means limited, unknown, pending, disabled, unavailable, or unparseable data. Blue is never counted as confirmed healthy. An empty incident view is shown only after valid data loads. Refresh failures preserve and visibly mark the last successful data stale.

## Requirements and commands

Node.js 22+ and npm are required.

```bash
npm ci                       # reproducible install
npm run dev                  # local Vite server
npm run validate-providers  # validate the 90-provider catalog
npm test                     # deterministic Node unit tests
npm run test:watch           # watch tests
npm run typecheck            # strict TypeScript checks
npm run update-status        # fetch live official sources
npm run build                # validate, fetch live data, typecheck, build
npm run build:app            # deterministic Vite-only build (used on PRs)
npm run preview              # serve dist locally
```

Tests use mocked fetch responses and do not contact vendors. Generated `public/status.json`, `dist`, and test reports are ignored and must not be committed.

## UI semantics

The dashboard provides global and incident counts, last successful generation, manual and once-per-minute automatic refresh (paused while hidden), stale/error/loading announcements, provider search, and severity/category/source-state filters. Every provider has expandable source diagnostics and safe official links. Limited sources remain visible in blue. Disabled sources are excluded from operational counts.

## Catalog and parsers

To add a provider, edit `config/providers.json`, retain the expected count intentionally, run validation and tests, then add a parser only if an existing `sourceType` cannot represent the official source. Each entry requires `id`, `name`, `category`, `url`, and `sourceType`; `priority` is a non-negative integer, `enabled` is boolean, and `services` is an optional string array. Limited source types require a useful `message` explaining the limitation. HTTP(S) URLs only; intentional shared official URLs are reported as warnings.

Parsers live in `scripts/update-status.mjs`. Keep external boundaries defensive, return blue diagnostics for source/parser failures, filter resolved/maintenance/old events, and add mocked fixtures/tests. Supported implementations are Statuspage, RSS, Google Cloud/Workspace, Salesforce, Slack, Heroku, stable official HTML, Microsoft limited public data, and limited official pages.

## Deployment

`.github/workflows/refresh-pages.yml` is the sole Pages workflow. Pushes to `main`, manual dispatches, and the twice-hourly schedule (`17,47 * * * *`) install with `npm ci`, validate, test, typecheck, fetch live status once, build once, upload `dist`, and deploy once. `.github/workflows/test.yml` performs deterministic PR checks without live vendor requests. Configure **Settings → Pages → Source → GitHub Actions**. Vite's `/sst/` base matches the `dmo18/sst` repository path.

## Version and releases

`package.json` is the single version source. The lockfile follows npm tooling; the UI imports package metadata and the fetcher reads it for its user agent. Release checklist: run all validation commands, review generated diagnostics without committing them, update `CHANGELOG.md`, increment the patch once, verify the diff, commit, and let the Pages workflow deploy `main`.

## Limitations and troubleshooting

Only public official information is represented; localized/account-specific outages may not be public. Microsoft 365 and Entra tenant service health requires authenticated Microsoft Graph and deliberately remains limited here—this static public product does not accept credentials. A reachable feed does not prove service health. If data is unavailable, inspect expandable fetch/parser logs and the Pages Actions run; validate catalog URLs/source types locally. If the site 404s, verify Pages uses GitHub Actions and the repository remains named `sst`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for change standards and [docs/repository-report.md](docs/repository-report.md) for the concise architecture reference.
