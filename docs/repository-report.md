# Repository architecture report

## Production path

The product is a static Vite/React application. `config/providers.json` is validated by `scripts/validate-providers.mjs`; `scripts/update-status.mjs` performs bounded official-source retrieval and atomically writes schema-versioned `public/status.json`; React loads only that artifact. `src/dataLifecycle.ts` owns explicit loading/ready/refreshing/stale/error transitions, `src/statusViewModel.ts` merges all catalog entries without false-green fallbacks, and `src/IssueConsole.tsx` renders incidents and searchable diagnostics.

```text
package.json version -> browser label + fetcher user-agent
providers.json -> validator -> fetcher/parsers -> status.json
status.json + providers.json -> lifecycle/view model -> accessible UI
refresh-pages.yml -> checks + live generation + Vite -> one Pages deployment
```

## Automation

- `.github/workflows/test.yml`: deterministic PR catalog validation, unit tests, typecheck, and Vite build using Node 22 and `npm ci`; it performs no live vendor fetch.
- `.github/workflows/refresh-pages.yml`: the only deployment workflow; push to `main`, manual, and twice-hourly triggers run checks, one live generation, one build, and one deployment under concurrency group `pages`.
- No recurring cron probe or duplicate deploy workflow remains.

## Operational contracts

There are exactly 90 configured providers. Browser code never fetches vendor endpoints. Failures are source-health diagnostics (blue), not outages or healthy results. A valid empty payload alone permits the clear state. Generated status is ignored by Git, payload consistency is checked before atomic publication, and public sources require no secrets. Tests cover lifecycle, view-model sorting/counting/fallbacks, Statuspage and RSS behavior, Microsoft limitations, malformed data, normalization, and fetch failure.
