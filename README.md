# MSP Service Heads-Up Console

A static, official-source-only service-status intelligence and early-warning dashboard for MSP technicians. The live site is **https://dmo18.github.io/sst/**. It answers what needs attention, which official sources can be trusted, what changed, and what cautious client communication may be appropriate without a backend, database, credentials, paid API, browser-side vendor calls, or unofficial outage scraping.

## Operational workflow

The first view is a technician briefing: critical/action items, new and resolved incidents, new source gaps, coverage, and separate service/source conclusions. Active major and degraded incidents follow, then recent changes and provider diagnostics. **Operator mode** provides search, combined filters, history, attempt logs, impact/action guidance, official links, and locally generated copyable communication drafts. **Wallboard mode** is a full-viewport, non-scrolling TV display with Heads Up, All Providers, and Source Health screens. It includes a local clock, generated/check times, explicit 40/60-minute stale warnings, paginated provider grids, fullscreen and optional Wake Lock controls, and reduced-motion-aware rotation. Every provider remains reachable without continuous scrolling.

Wallboard startup is URL-controlled: `?view=wallboard&screen=heads-up`, `screen=providers`, or `screen=sources`; `density=comfortable|compact` selects grid density and `rotate=SECONDS` enables bounded screen/page rotation. A zero rotation value disables rotation. Operator mode can be selected explicitly with `?view=operator`.

Drafts are explicitly labeled, avoid asserting client impact, contain no unsupported estimates, and require technician review. Search covers provider, category, tags, service names, incident titles, and details. Filters include attention, recent change, incident, unavailable/limited source, criticality, operational state, and MSP-relevant domains.

Provider identification uses bundled brand marks where the repository has an approved asset. Every remaining provider receives a deterministic local monogram icon derived from its name and ID. Icons appear in incident and diagnostic views, require no external image request, and fall back safely if a bundled asset cannot load.

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

## External source research and adoption policy

The services below were reviewed on 2026-07-31 as design references, discovery aids, or possible licensed integrations. They are not runtime dependencies. Public commercial aggregator pages must not be scraped, copied, or treated as official vendor data. Crowdsourced reports must remain a separately labeled anomaly signal and must never create an official operational or incident conclusion.

### Source hierarchy

Use the highest available source in this order:

1. An authenticated official tenant, account, customer, region, or contract-specific API with read-only access.
2. An official public structured API, including vendor JSON, Atlassian Statuspage, Status.io, Better Stack, or a documented provider-specific endpoint.
3. An official RSS or Atom feed that preserves incident identity, timestamps, lifecycle, components, and region where available.
4. An official public page parsed by a provider-specific, fixture-tested adapter that fails closed when the structure changes.
5. A licensed commercial aggregator API only when the original official source is unavailable or materially incomplete, and only after validating service coverage, rate limits, attribution, retention, display, and redistribution terms.
6. A licensed crowdsourced or telemetry-based API only as corroborating evidence. It must be labeled third-party observed or possible problem, never official incident or operational truth.

### Engineering methods worth adopting

- Prefer documented status and incident endpoints over page-wide HTML. Probe standard Statuspage paths such as `/api/v2/summary.json`, `/api/v2/incidents.json`, and `/api/v2/components.json` only after confirming they belong to the provider.
- Add a first-class Status.io public API adapter. Status.io exposes overall state, components, locations, active incidents, maintenance, messages, lifecycle codes, and affected components in structured data.
- Preserve the provider incident ID, source URL, incident lifecycle, first detection, latest update, affected components, affected regions, and maintenance classification as separate fields.
- Filter by the incident's affected component and region, not by unrelated navigation, support, or footer text from the source page.
- Keep incidents, planned maintenance, security events, informational notices, release notes, and marketing posts as distinct record classes.
- Deduplicate by provider incident ID and normalized provider scope. Repeated updates should update one incident while preserving its first and latest timestamps.
- Reuse one bounded request when multiple catalog entries share the same official source, then split records by explicit product/component identity.
- Send a recognizable `User-Agent` and parser-specific `Accept` header. Honor rate limits, bounded retries, `Retry-After`, `ETag`, and `Last-Modified` where supported.
- Track source schema fingerprints, parser failures, last successful retrieval, and content-type changes so silent adapter breakage becomes an explicit source failure.
- Use read-only OAuth or narrowly scoped credentials for private status sources. Never place customer or tenant credentials in the browser or generated payload.
- Fail closed. Empty, malformed, login, bot-protection, consent, or unknown-schema responses must remain `unknown`, `limited`, or `unavailable`, never operational or incident.

### Candidate source work

- **HaloPSA and ConnectWise:** both public pages use Status.io. Discover and validate their Status.io public API identifiers, then replace limited or fragile HTML parsing with a structured Status.io adapter.
- **Microsoft 365 and Entra ID:** use Microsoft Graph Service Communications with `ServiceHealth.Read.All` for tenant-specific truth. Public Microsoft feeds remain broad fallback context and cannot prove an individual customer tenant is healthy.
- **QuickBooks:** Intuit exposes a structured developer-status API for the QuickBooks Online API component. Treat that as a distinct developer/API source unless its scope is proven to represent the end-user QuickBooks Online service.
- **IncidentHub or IsDown:** evaluate one licensed aggregator API as an optional fallback for providers whose official pages are blocked, unstable, or incomplete. Do not integrate both as competing sources without a deterministic precedence policy.
- **Downdetector Enterprise:** consider only as a secondary anomaly signal for ISP and large consumer-platform problems. Its report-volume baseline is valuable corroboration but is not an authoritative incident source.
- **StatusSight and the DrDroid repository:** use as endpoint-discovery and parser-method references. Do not scrape their public dashboards or rely on undocumented redistribution rights.

### Research references

| Reference | Useful takeaway | Adoption boundary |
| --- | --- | --- |
| [IncidentHub knowledge base](https://incidenthub.cloud/knowledge-base) | Component and region filtering, incident lifecycle alerts, maintenance separation, and monitoring-failure awareness. | Methodology reference only unless a licensed API contract is established. |
| [IncidentHub](https://incidenthub.cloud/) | Large monitored-service catalog, private source ingestion, read-only account sources, and per-client status views. | Possible licensed fallback or private-source integration, not a page-scraping target. |
| [IncidentHub documentation](https://docs.incidenthub.cloud/) | Webhook payloads distinguish triggered, updated, and resolved events and include affected components. | Public webhook documentation does not by itself establish a general reusable query API. |
| [Downdetector companies](https://downdetector.com/companies/) | Broad vendor discovery and report-volume anomaly detection against service-specific historical baselines. | Enterprise API only, and only as separately labeled crowd corroboration. |
| [StatusSight creator post](https://www.reddit.com/r/SideProject/comments/1enbsgc/i_created_a_status_page_aggregator_that_monitors/) | Prefer public JSON files over inconsistent HTML and poll frequently with a dedicated collector. | Community methodology, not an upstream data contract. |
| [StatusSight](https://statussight.com/) | Component-level display, recent incidents, large catalog, and visible source recency. | Discovery/reference only because no public API or redistribution terms were identified. |
| [Status Aggregator](https://statusaggregator.com/) | IsDown workflow of connect, poll, normalize, filter, and alert across public and private sources. | Licensed IsDown API candidate only, never scrape the marketing dashboard. |
| [DrDroid status-page aggregator](https://drdroid.io/status-page-aggregator) | Database-backed polling, normalized vendor records, change-based alerting, and custom/private service support. | Product and architectural reference. |
| [DrDroid open-source repository](https://github.com/DrDroidLab/status-page-aggregator) | MIT implementation with separate JSON, RSS, Atom, and Better Stack adapters, incident endpoints, persistence, and priority alerts. | Endpoint candidates must still be independently verified against official provider scope. |
| [IsDown article](https://medium.com/isdown/status-page-aggregator-monitor-all-your-services-8c3e3e993b7b) | Continuous polling, normalization, filtering, historical tracking, and RSS/Atom/Statuspage support. | General methodology only because the article contains inconsistent polling-frequency claims. |

## Limitations

Official public status may omit account-, tenant-, region-, or address-specific effects. Microsoft 365 and Entra ID details require tenant-authenticated Microsoft Graph service communications; this public static application intentionally accepts no credentials and labels unauthenticated Microsoft coverage limited. A provider source outage is not evidence of a vendor outage. See [the repository report](docs/repository-report.md) and [contribution guide](CONTRIBUTING.md).
