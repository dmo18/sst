# MSP Service Heads-Up Console

A static, official-source-only service-status intelligence and early-warning dashboard for MSP technicians. The live site is **https://dmo18.github.io/sst/**. It answers what needs attention, which official sources can be trusted, what changed, and what cautious client communication may be appropriate—without a backend, database, credentials, paid API, browser-side vendor calls, or unofficial outage scraping.

## Operational workflow

The first view is a technician briefing: critical/action items, new and resolved incidents, new source gaps, coverage, and separate service/source conclusions. Active major and degraded incidents follow, then recent changes and provider diagnostics. **Operator mode** provides search, combined filters, history, attempt logs, impact/action guidance, official links, and locally generated copyable communication drafts. **Wallboard mode** persists locally and enlarges the high-attention/changed subset for shared displays without auto-scroll or animation.

Drafts are explicitly labeled, avoid asserting client impact, contain no unsupported estimates, and require technician review. Search covers provider, category, tags, service names, incident titles, and details. Filters include attention, recent change, incident, unavailable/limited source, criticality, operational state, and MSP-relevant domains.

## Health contract and no-false-green guarantee

Schema v2 gives every provider two machine-readable states:

- `service_state`: `operational`, `degraded`, `major`, or `unknown`.
- `source_state`: `available`, `limited`, `unavailable`, `disabled`, `pending`, or `stale`.

Presentation text and colors never determine these states. Source success alone is not operational confirmation; limited sources remain unknown. Fetch/parser/content-type/size failures are source failures, never vendor incidents. Disabled providers are excluded from enabled coverage and health counts. The generator reconciles every aggregate before atomic publication, and the browser independently validates the complete payload. Therefore absent/incomplete data cannot produce a green conclusion. Coverage is available enabled sources divided by enabled providers; confirmed-operational coverage is separately reported.

Attention (`critical`, `action`, `watch`, `informational`) expresses technician priority, not incident severity. Critical generally means a major/high-impact incident; action means confirmed degradation or an important source loss; watch covers gaps/recovery; informational covers stable confirmations.

## Change detection and metadata

The Pages build optionally downloads the last deployed, validated snapshot. Comparison identifies new/escalated/de-escalated/resolved incidents, service degradation/recovery, and unavailable/limited source transitions. Initial generation creates no mass event; retrieval failure does not fail the build; history is bounded to 100 entries and generated JSON is never committed.

The 90-provider catalog supports optional `criticality`, `tags`, `services`, `client_impact`, and `technician_action`. High-value identity, cloud, security, DNS, RMM/PSA, email, and connectivity entries receive specific guidance rather than generic filler. `scripts/validate-providers.mjs` validates types, concise guidance, URLs, unique IDs, source types, and counts.

## Static architecture and commands

```text
config/providers.json -> validation -> bounded official retrieval -> validated public/status.json
package.json + React/Vite + status.json -> dist -> GitHub Pages
browser -> deployed status.json only
```

Node 22+ is required.

```bash
npm ci
npm run validate-providers
npm test                    # deterministic mocks; no live vendors
npm run typecheck
npm run build:app           # deterministic Vite build
npm run update-status       # one live official-source generation
npm run build               # validate + live generation + typecheck + Vite
npm run preview
npm audit --audit-level=high
```

Retrieval checks Content-Length, streams up to a configurable 2 MiB limit, validates parser-specific content types, uses a 12-second timeout and at most one bounded retry for transient network/408/429/5xx failures, and rejects incidents over five minutes in the future. Attempt diagnostics include content type. Responses, history, and output are bounded.

## CI and deployment

`.github/workflows/test.yml` runs `npm ci`, provider validation, deterministic tests, typecheck, and `build:app` on pull requests without vendors. The sole Pages workflow triggers on `main`, manual dispatch, and at minutes 17/47. Its **build** job has only `contents: read`, runs checks, one live generation, one Vite build, and uploads `dist`; its dependent **deploy** job alone has `pages: write` and `id-token: write`. One concurrency group prevents overlapping deployments. Vite base `/sst/` is fixed for Pages; `status.json` and logos are copied into `dist`.

## Limitations

Official public status may omit account-, tenant-, region-, or address-specific effects. Microsoft 365 and Entra ID details require tenant-authenticated Microsoft Graph service communications; this public static application intentionally accepts no credentials and labels unauthenticated Microsoft coverage limited. A provider source outage is not evidence of a vendor outage. See [the repository report](docs/repository-report.md) and [contribution guide](CONTRIBUTING.md).
