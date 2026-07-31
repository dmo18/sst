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

## Source intelligence and maintenance

Every provider now records an evidence tier and confidence level independently of service health. Supported structured sources also publish component state, bounded incident and maintenance timelines, parser version, structural schema fingerprint, last successful retrieval, consecutive failures, and last semantic change. Schema drift and repeated failures become explicit source-intelligence events rather than vendor outages.

Planned maintenance is a separate record class with start/end times, lifecycle state, affected services, official links, and update history. Routine maintenance does not inflate incident counts; emergency work or maintenance that escalates to current customer impact remains an active incident. Lifecycle history retains 200 bounded records.

## Change detection and metadata

The Pages build optionally downloads the last deployed, validated snapshot. Comparison identifies new/escalated/de-escalated/resolved incidents, service degradation/recovery, and unavailable/limited source transitions. Initial generation creates no mass event; retrieval failure does not fail the build; history is bounded to 200 entries and generated JSON is never committed.

The canonical 78-provider catalog supports optional `criticality`, `tags`, `services`, `client_impact`, and `technician_action`. High-value identity, cloud, security, DNS, RMM/PSA, email, and connectivity entries receive specific guidance rather than generic filler. `scripts/validate-providers.mjs` validates types, concise guidance, URLs, unique IDs, source types, and counts.

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

`.github/workflows/test.yml` runs `npm ci`, provider validation, deterministic tests, typecheck, and `build:app` on pull requests without vendors. The sole Pages workflow triggers on `main`, manual dispatch, and at minutes 7, 19, 31, 43, and 55. Its **build** job has only `contents: read`, runs catalog validation, one live generation, both server and browser payload validation, and one Vite build. Its dependent **deploy** job alone has `pages: write` and `id-token: write`; after publication it fetches the deployed HTML, JavaScript, CSS, and status payload and renders the live page in headless Chrome. The deployment success marker is written only after those production smoke checks pass. One concurrency group prevents overlapping deployments. Vite base `/sst/` is fixed for Pages; `status.json` and logos are copied into `dist`.

## External source research and adoption policy

The references below were reviewed on 2026-07-31 for ideas, source discovery, and parser methodology. They are **not runtime dependencies**. This project remains free and static: no API keys, credentials, authenticated tenant access, paid feeds, licensed aggregators, commercial monitoring services, or scraping of aggregator dashboards.

Commercial aggregators and crowdsourced outage sites may identify patterns or point to an official status page, but their claims cannot become an official service conclusion. Any endpoint discovered through a third party must be independently verified as a public first-party vendor source before it can enter the catalog.

### Allowed source hierarchy

Use the highest available free, unauthenticated, first-party source in this order:

1. An official public structured status or incident endpoint, including documented vendor JSON, Atlassian Statuspage, Status.io, Better Stack, Instatus, or another vendor-owned schema.
2. An official RSS or Atom feed that preserves incident identity, timestamps, lifecycle, components, and regional scope where available.
3. An official public HTML page parsed by a provider-specific, fixture-tested adapter that fails closed when its structure changes.
4. A bundled limited record when no trustworthy public source is readable. Limited records remain `unknown` and never imply operational health.

Not allowed as runtime truth:

- authenticated or tenant-specific APIs;
- commercial aggregator APIs or dashboards;
- crowdsourced outage volume;
- social-media posts;
- copied incident data whose redistribution terms are unknown;
- generic search results, marketing pages, release notes, or news posts.

### Engineering methods worth adopting

- Prefer structured incident and component endpoints over page-wide HTML. Probe conventional paths such as `/api/v2/summary.json`, `/api/v2/incidents.json`, `/api/v2/components.json`, `status.json`, `incidents.json`, `index.json`, `history.rss`, and `history.atom` only after confirming the hostname belongs to the provider.
- Build explicit adapters by status-page platform rather than broad keyword scraping: Atlassian Statuspage, Status.io, Better Stack, Instatus, RSS, Atom, and provider-specific JSON.
- Preserve the provider incident ID, source URL, lifecycle state, first detection, latest update, affected components, affected regions, impact, and maintenance classification as separate fields.
- Filter by the incident record's title, components, locations, and region metadata—not navigation, footer, support, or unrelated page text.
- Keep incidents, planned maintenance, security advisories, informational notices, release notes, and marketing posts as separate record classes.
- Deduplicate by provider incident ID plus normalized component scope. Repeated updates should mutate one incident while preserving both first-detected and latest-update timestamps.
- Reuse one bounded request when multiple products share an official source, then split records only by explicit product or component identity.
- Track source schema fingerprints, content type, parser version, last successful retrieval, consecutive failures, and last semantic change so silent adapter breakage becomes an explicit source problem.
- Use conditional retrieval with `ETag` and `Last-Modified` when supported, honor `Retry-After`, and retain bounded timeouts, response limits, retries, and concurrency.
- Keep a fixture corpus containing real operational, degraded, major, maintenance, marketing, login, bot-challenge, empty, malformed, and region-specific responses for every adapter.
- Run source canaries that test parsing and schema shape separately from service health. A parser failure must not be reported as a vendor incident.
- Fail closed. Empty, malformed, login, bot-protection, consent, unknown-schema, or nonspecific responses remain `unknown`, `limited`, or `unavailable`, never operational or incident.

### Ideas evaluated from the references

- **IncidentHub:** useful concepts include component and region subscriptions, incident lifecycle transitions, monitoring-failure alerts, maintenance separation, per-customer dependency views, and explicit triggered/updated/resolved events. Adopt the data model and lifecycle discipline, not the commercial service.
- **Downdetector:** report volume compared with a historical baseline can help humans recognize a possible widespread outage. Because it is crowdsourced and commercial, use it only as an external manual corroboration reference—not as a runtime source or health conclusion.
- **StatusSight:** useful presentation ideas include source recency, component-level status, recent incident history, and a large searchable service directory. Its public dashboard is a discovery aid only.
- **Status Aggregator / IsDown:** useful workflow ideas are polling, normalization, component filtering, change detection, history, and alert suppression. The commercial service and its copied catalog are not runtime dependencies.
- **DrDroid:** the open-source repository demonstrates separate JSON, RSS, Atom, and Better Stack adapters; incident-detail endpoints; service priority; persistence; a recognizable user agent; and change-only notifications. Its Supabase, email, credentials, and paid-service architecture are out of scope here.
- **Reddit creator post:** reinforces the practical value of structured JSON over brittle page scraping and a dedicated collector that publishes a simple browser-readable artifact. Community claims remain methodology only.

### Public first-party source candidates to verify

The DrDroid repository and the aggregator directories expose useful endpoint leads. These are **unverified candidates**, not accepted sources. Before adding one, confirm ownership, current schema, service scope, regional meaning, maintenance behavior, and terms directly from the vendor.

| Candidate provider or scope | Public endpoint pattern to verify | Notes |
| --- | --- | --- |
| ServiceNow | `https://servicenow.statuspage.io/api/v2/incidents.json` | Verify that the page represents the intended ServiceNow cloud products and regions. |
| SendGrid | `https://status.sendgrid.com/api/v2/incidents.json` | Structured Statuspage candidate; separate from broader Twilio incidents. |
| Twilio | `https://status.twilio.com/api/v2/incidents.json` | Validate component and regional filtering before catalog use. |
| Fastly | `https://www.fastlystatus.com/status.json` and `incidents.json` | Nonstandard public JSON candidate. |
| Akamai | `https://www.akamaistatus.com/api/v2/incidents.json` | Validate whether all relevant Akamai products are represented. |
| DigitalOcean | `https://status.digitalocean.com/api/v2/incidents.json` | Standard Statuspage candidate. |
| Linode / Akamai Connected Cloud | `https://status.linode.com/api/v2/incidents.json` | Confirm branding, scope, and whether it duplicates Akamai coverage. |
| Oracle Cloud Infrastructure | `https://ocistatus.oraclecloud.com/api/v2/incidents.json` | Confirm region/component metadata and public availability. |
| GitLab | `https://status.gitlab.com/pages/5b36dc6502d06804c08349f7/rss` | RSS candidate; verify incident identity and update ordering. |
| AWS | `https://status.aws.amazon.com/rss/all.rss` | Broad official feed; requires strict service and US-region scoping. |
| Azure | `https://azure.status.microsoft/en-us/status/feed/` | Broad official feed; do not infer tenant-specific health. |
| Xero API | `https://status.xero.com/api/v2/incidents.json` | Developer/API scope may not represent the full end-user service. |
| FreshBooks API | `https://status.freshbooks.com/api/v2/incidents.json` | Confirm whether it covers the customer application or only APIs. |
| QuickBooks Online API | `https://status.developer.intuit.com/api/v2/incidents.json` | Treat as developer/API status unless end-user scope is proven. |
| Better Stack-hosted pages | `index.json` plus the page's official feed | Build a generic adapter only after validating the documented schema. |
| Status.io-hosted pages | Provider-specific public status and incident endpoints | Highest-priority adapter research for HaloPSA and ConnectWise. |

No candidate should be added solely because it appears in another aggregator's source code. Each must pass a live-source probe, fixture tests, US-scope review, and fail-closed validation.

### Research references

| Reference | Useful takeaway | Adoption boundary |
| --- | --- | --- |
| [IncidentHub knowledge base](https://incidenthub.cloud/knowledge-base) | Component and region filtering, lifecycle alerts, maintenance separation, and monitoring-failure awareness. | Design reference only; no commercial dependency or copied incident data. |
| [IncidentHub](https://incidenthub.cloud/) | Dependency views, broad service discovery, private-source concepts, and per-customer grouping. | Discovery and product reference only. |
| [IncidentHub documentation](https://docs.incidenthub.cloud/) | Triggered, updated, and resolved event semantics with affected components. | Schema inspiration only; webhook documentation is not a reusable public feed. |
| [Downdetector companies](https://downdetector.com/companies/) | Broad provider discovery and anomaly-baseline concepts. | Manual corroboration only; crowdsourced reports are not official truth. |
| [StatusSight creator post](https://www.reddit.com/r/SideProject/comments/1enbsgc/i_created_a_status_page_aggregator_that_monitors/) | Prefer structured JSON over inconsistent HTML and publish a simple collected artifact. | Community methodology only. |
| [StatusSight](https://statussight.com/) | Component display, source recency, incident history, and searchable catalog ideas. | Discovery/reference only; do not scrape its dashboard. |
| [Status Aggregator](https://statusaggregator.com/) | Poll, normalize, filter, detect changes, retain history, and suppress noise. | Commercial IsDown reference only. |
| [DrDroid status-page aggregator](https://drdroid.io/status-page-aggregator) | Adapter separation, persistence, priority services, and change-based notifications. | Architecture reference; hosted dependencies are outside this project. |
| [DrDroid open-source repository](https://github.com/DrDroidLab/status-page-aggregator) | MIT code with Statuspage JSON, RSS, Atom, Better Stack, incident-detail, and endpoint candidate lists. | Verify every endpoint independently before use; do not copy unverified status conclusions. |
| [IsDown article](https://medium.com/isdown/status-page-aggregator-monitor-all-your-services-8c3e3e993b7b) | Normalization, filtering, historical tracking, and multi-format ingestion. | General methodology only; no commercial integration. |

## Limitations

Official public status may omit account-, tenant-, region-, or address-specific effects. Microsoft 365 and Entra ID public feeds cannot prove an individual customer tenant is healthy. This static application intentionally accepts no credentials and uses no paid or authenticated sources. A provider source outage is not evidence of a vendor outage. See [the repository report](docs/repository-report.md) and [contribution guide](CONTRIBUTING.md).
