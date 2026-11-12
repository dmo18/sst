# Changelog

## Compact office feed revision

The 458×290 office tile now uses a seamless vertical incident feed instead of eight-second pages. Rows include a brief verbatim vendor description; the fixed footer shows plainly labeled data freshness. Full-size views and collection semantics are unchanged.

All notable changes to the Service Heads-Up Console are recorded here.

The project uses semantic versioning. Dates are shown in ISO format. The newest released version must match `package.json`.

## Unreleased

### Technical console restyled (November 12, 2026)

- The technical console and the panels that open over it (Microsoft 365 coverage, Dependency Universe, command palette, provider drawer, operations intelligence) now use the same light look as the status screen: light surfaces, dark text, one accent, 15 pixel body text with nothing below 14. Every view and feature is kept.
- Yardi has its own mark, cropped from the logo on its status page, so no provider uses a generated letter tile.

## [3.4.0] - 2026-11-12

### Application layout and Eastern time (November 12, 2026)

- The default status screen is now a compact application layout: a sticky top bar with a live "Updated" indicator, one summary card with the four totals and a proportion bar, issue cards on the left, the full service list with a filter and search on the right, and a slide-in panel for one service. Body text is 15 pixels and nothing is below 14.
- A System details card on the status screen shows the version, build commit, build time, release and collection run IDs, data and browser check times, pipeline version, live source coverage and request success.
- Fixed: the technical console's top bar ran 66 pixels past a 1440 pixel viewport when the browser fell back to a wide font, which failed the deployed product check. The bar now wraps.
- Yardi is now monitored from its official Statuspage summary (`https://status.yardi.com/api/v2/summary.json`), in a new Property Management category. The catalog is 81 raw entries with 42 active.
- UTC and GMT times written inside vendor incident and maintenance text are shown in Eastern time on every screen (`src/easternTime.ts`). Only the clock time is rewritten.

### Plain status screen, wallboard clipping, refresh stall (November 12, 2026)

- The default screen is now a plain, light status screen modeled on the vendors' own status pages: one verdict sentence, major outages, degraded and unconfirmed services as single rows, then every service on one line. Selecting a service shows the vendor's text and updates. Body text is 20 pixels and nothing is below 18. The previous console remains at `?console=full`.
- Fixed: at 458 by 291 the compact wallboard column grew to the width of its heading or footer line when many providers were affected, so every incident row was cut off on the right and the age was hidden. The column may now shrink.
- Fixed: a release that failed a post-deploy check did not renew the refresh keeper, so the data stopped refreshing (40 minutes on November 12). A failed scheduled or push release now renews it.
- Release and product checks open the technical console with `?console=full`.

### Readable operator interface (November 12, 2026)

The operator application was redesigned for legibility. The wallboard is unchanged.

- The overview now leads with one plain sentence ("5 services have a major outage") and four totals, then "Problems right now" as large cards (state, vendor, title, vendor text, last update), then every service grouped as having problems, not confirmed or working normally. Collection metrics and tables are folded under "Technical detail".
- A new stylesheet, `src/styles/readable.css`, raises text to an 18 pixel base with nothing below 15 pixels, uses plain high-contrast panels with no gradients or blur behind text, writes labels in sentence case, and always names a state in words as well as color.
- Every rule in that stylesheet is scoped to `.app-frame[data-surface="operator"]`; a test enforces the scope and the minimum text size.

### Source truth review (November 10, 2026)

A top-to-bottom review compared every enabled provider against what the vendor publishes. Before it, one collection reported 6 providers unknown and 4 blind, and hid five live vendor incidents. After it, the same collection reports 41 of 41 sources read, 40 of 41 with a confirmed service state, no blind sources, and no provider needs a headless browser render.

#### Fixed

- A live incident was treated as over, or as planned work, when words such as "planned", "completed", "closed" or "fixed" appeared anywhere in the vendor's prose. A current Datto RMM incident on the Kaseya page was dropped for this reason. Lifecycle is now read from the vendor's status field and an explicit title prefix only.
- Statuspage components were de-duplicated by bare name and cut to 36 before problem detection, so a degraded child could be hidden behind a healthy component of the same name in another group. Identity is now group plus name and problem components are always retained.
- A vendor-declared incident with no usable title no longer lets the provider read as healthy.
- The Statuspage `maintenance` indicator is published as planned work with an operational state, not as an unknown state. Statuspage-compatible hosts may omit an empty incident list.
- Keyword rules written for rendered pages ran over JSON documents that an adapter had not recognized, and could report a provider healthy from field values. Such a document now fails closed.
- Schema fingerprints describe the document envelope. An incident opening is no longer scored as schema drift, which had lowered a correct source's quality score at the moment it mattered.
- The browser re-read of Statuspage vendors used its own parser with no region scope, advisory filter or evidence-age limit, and replaced the collector's result on screen. It now uses the collector's parser.
- A stalled `status.json` request held the only request slot forever. Requests are aborted after 20 seconds and the stale warning stays visible while a retry is in flight.
- One incident crossing the 72 hour evidence limit between publication and fetch invalidated the whole payload in the browser. Evidence age is judged at generation time.
- The wallboard showed zero incidents and "No active vendor incidents" when no payload had loaded.
- The post-deployment smoke check required a payload under five minutes old, which no deployment that needed a retry could satisfy. It now allows the documented 20 minute threshold; the run identity check is unchanged.
- The previous-snapshot download is retried, so one transient failure no longer erases history, reliability windows and failure streaks.

#### Changed

- Pages deployments are spaced to about six an hour instead of eleven. The release cron runs every ten minutes, and the freshness watcher and the continuity keeper never dispatch within nine minutes of the previous release start, whatever its outcome. The watcher treats the payload as stale at 14 minutes, and recovery takes over a release only after 45 minutes instead of 12, so it no longer cancels a release that can still finish.
- A release run stuck in the queue is replaced after 12 minutes. Only a release that is actually running is given 45 minutes. On November 11 a run that never started held recovery back for 50 minutes.
- An N-able or Cove service under maintenance that the vendor has started is published as planned maintenance with an operational state. It was reported as unknown.
- A Microsoft 365 outage was not published on November 12, 2026. Microsoft's admin-center document carried the incident, but its consumer document returned HTTP 501 and the collector required both before concluding anything. A degradation in any readable Microsoft document is now always published; only the healthy conclusion needs both documents.
- A Microsoft status document that the primary host fails to return is read from Microsoft's second first-party host, `msit.status.cloud.microsoft`.
- `CLAUDE.md` now records two deliberate exceptions it previously contradicted: the browser re-read of official Statuspage summaries, and severity-first ordering on the compact tile.
- Microsoft 365 is read from the JSON documents behind Microsoft's public status page (`status.cloud.microsoft/api/posts/mac`, `ppac`, `m365Consumer`): the Microsoft 365 admin center, the Power Platform admin center and each consumer workload. No tenant, token or sign-in is involved. The provider is operational only when Microsoft publishes every one of those services as healthy, and remains unknown on a missing document, an unrecognized state or a changed shape.
- ConnectWise and HaloPSA are read from the Status.io public API, including its numeric lifecycle codes, affected components and locations.
- N-able and Cove Data Protection are read from the public dashboard data document, scoped to Americas and global services.
- RingCentral is read from `status.json`, Salesforce from the Trust incidents API, Google Workspace and Google Cloud from `incidents.json`, and Sophos from its StatusCast summary.
- Keeper, Xero, NUSO and Bitdefender GravityZone are read from their Statuspage JSON summaries.

### Fixed

- Replaced the three-dispatch freshness bridge that expired after about 17 minutes with a renewable GitHub-native heartbeat. Each finite keeper sends recovery dispatches every 330 seconds for up to 319 minutes, then explicitly hands off through `workflow_dispatch`. A successful push/schedule or an offset hourly seed restarts it if necessary.
- Preserved the single Pages release concurrency group, fail-closed official source interpretation, the independent freshness watcher and the visible 20-minute browser stale warning. GitHub-only freshness is best-effort and not a hard uptime guarantee.

## [3.3.8] - 2026-08-20

### Fixed

- Increased the Dependency Universe provider-ring stagger so dense live provider labels remain readable without relaxing the collision safety threshold.
- Added a geometry regression requiring the provider orbit to retain at least 40 units of radial spread.


## [3.3.7] - 2026-08-20

### Fixed

- Registered Shopify's official Statuspage JSON summary with the structured-adapter registry so current incidents, component impact, and vendor timestamps are parsed instead of falling through to the legacy HTML parser.
- Added regression coverage that exercises the production Shopify JSON route through provider conclusion generation.


## [3.3.6] - 2026-08-20

### Fixed

- Moved Shopify production collection from presentation HTML to Shopify's official Statuspage JSON summary.
- Preserved current unresolved incidents, component impact, ISO vendor timestamps, and first-party fail-closed behavior through the existing structured adapter.


## [3.3.5] - 2026-08-20

### Fixed

- Accepted Shopify Statuspage timestamps whose visible markup inserts whitespace around date and time punctuation.
- Normalized the captured vendor time before incident identity and freshness validation.


## [3.3.4] - 2026-08-20

### Fixed

- Preserved Shopify's official current-update timestamp on parsed incidents so freshness validation accepts readable current evidence.
- Kept untimestamped Shopify incident references limited and fail-closed.


## [3.3.3] - 2026-08-20

### Fixed

- Corrected Shopify current-incident extraction when hidden subscription-template text appears before the visible incident content.
- Added an explicit unresolved-incident fallback so current vendor title and update evidence remain readable even when the homepage link markup changes.


## [3.3.2] - 2026-08-20

### Fixed

- Restored Shopify live-source coverage when its official page publishes a current incident by extracting the vendor incident title and bounded update details instead of reducing the page to an unidentified issue.
- Preserved fail-closed behavior when Shopify exposes an incident link without readable current update details.


### Wallboard and deployment stabilization

- Added rolling wallboard alert windows such as `alerts=36h` and applied the same filtered incident set to the incident list and provider rail.
- Added continuously looping labeled provider chips and incident rows for unattended compact wallboards.
- Added exact 458 by 291 Yodeck production verification using Chrome DevTools device metrics instead of relying on browser window-size flags.
- Serialized Pages releases, disabled in-progress release cancellation, and prevented freshness recovery from dispatching over an active release.
- Restored full test, TypeScript, dependency-audit, payload, build, production-smoke, browser-render, and Yodeck validation to every release event.

### Architecture cleanup

- Removed the unused legacy `Wallboard` implementation and its obsolete settings, rotation, pagination, and tests.
- Removed the imperative wallboard DOM enhancement module and moved overlay state, controls, local-storage persistence, and freshness telemetry into React.
- Consolidated dedicated wallboard overlay, compact, and marquee styling into `wallboard-v2.css`.
- Replaced the checked-in deployment marker with build-generated commit, workflow-run, and generation metadata.
- Added production smoke validation that rejects a live deployment when its generated commit or run ID does not match the workflow being verified.
- Added regression contracts preventing the removed legacy wallboard ownership paths and checked-in deployment marker from returning.

## [3.3.1] - 2026-08-19

### Fixed

- Reduced the wallboard `Priority signals` label to the same 9px scale as Payload, Browser, and Refresh telemetry.
- Kept the label and freshness telemetry inline in a 28px compact header row so more wallboard height is available for incident content.
- Preserved the dedicated 458 by 291 provider-first signage composition and added regression coverage for the compact header behavior.

## [3.3.0] - 2026-08-02

### Fixed

- Rejected unresolved incident records when the official source has not published current evidence within 45 days, while retaining long-running incidents that have a recent vendor update.
- Prevented date-only lines and status-update timestamps from becoming incident titles.
- Corrected Cisco Umbrella parsing for spaced date punctuation and expanded international-region filtering for Dubai, Mumbai, Hyderabad, and Delhi.
- Removed malformed date-title events from the active payload and retained audit history.
- Changed ambiguous stale incident records to limited/unknown rather than presenting them as current incidents or confirmed healthy service.

### Mobile operations experience

- Replaced the wrapped horizontal desktop navigation with a fixed five-destination bottom navigation designed for phones.
- Added a compact sticky mobile header and lifecycle strip so operational content appears immediately.
- Replaced horizontally scrolling provider tables with touch-friendly provider summary cards.
- Reworked KPI, action queue, category, incident, maintenance, timeline, provider drawer, filter, and safe-area layouts for 360px, 390px, and 430px phone widths.
- Preserved continuously updating payload age, browser refresh countdowns, observation ages, source state, and fail-closed semantics.

## [3.2.0] - 2026-08-02

### Ultra-HD visual system

- Replaced the fixed-scale admin-panel styling with a progressively scaled visual system for laptop, ultrawide, 4K, 5K, and 8K displays.
- Added a 6,200px operating canvas, fluid typography, higher-resolution spacing, finer hairlines, deeper spatial hierarchy, and premium navigation, panel, table, drawer, and wallboard treatments.
- Changed standard desktop KPI presentation from eight cramped columns to a readable four-column rhythm while retaining eight-column telemetry on ultrawide and higher-resolution displays.
- Added dedicated 2,200px, 3,400px, and 5,000px breakpoints for larger rows, controls, logos, gutters, and metric surfaces.
- Added deterministic 8K compositor rules that remove oversized blur layers and preserve complete provider-table rendering under software and hardware acceleration.
- Added visual contract tests that protect stylesheet load order, progressive resolution breakpoints, reduced-motion support, desktop legibility, and 8K rendering safeguards.

### Trust and scope

- Preserved all first-party source, evidence, collection, refresh, status, and fail-closed behavior without adding external fonts, assets, services, credentials, API keys, or browser-side vendor calls.
- Validated the application with fresh first-party data and rendered production builds at 1,920×1,080, 3,840×2,160, and 7,680×4,320 before release.

## [3.1.0] - 2026-08-02

### Enterprise application experience

- Replaced the decorative command-center presentation with a restrained enterprise SaaS shell: persistent workspace navigation, compact top bar, flat data surfaces, dense information hierarchy, and consistent operational tables.
- Replaced provider cards with a sortable provider operations table showing service state, source health, event counts, quality, request latency, request success, and observation age in directly comparable columns.
- Added continuously updating Eastern time, payload age, last browser check, next-refresh countdown, incident ages, source-observation ages, and wallboard timestamps without inventing streaming vendor data.
- Added a live KPI strip for incidents, affected providers, confirmed operational providers, coverage, collection quality, blind spots, request success, and p95 latency.
- Reworked incident operations, source reliability, timeline, maintenance, provider details, and wallboard layouts for clearer scanning and lower visual noise.
- Added deterministic tests for second-, minute-, hour-, and day-level relative time plus refresh-countdown boundaries.

### Trust and deployment safety

- Preserved the first-party-only, unauthenticated, fail-closed data contract and the separation between service health and collection health.
- Kept existing browser-render deployment markers while adding enterprise UI smoke assertions for live fields and provider tables.

## [3.0.0] - 2026-08-01

### Rebuilt

- Replaced the long-form dashboard with an operator-first command center: Overview, Incident Room, Provider Intelligence, Source Integrity, Timeline, and a full-screen wallboard.
- Added an action queue that ranks active vendor incidents, in-progress maintenance, critical source blind spots, repeated collection failures, and parser schema drift.
- Added provider detail drawers with the observation contract, evidence tier, truth basis, quality score, freshness, parser, schema, request trace, incidents, maintenance, and component state.
- Added a responsive dependency landscape, collection trust distribution, source-quality table, keyboard navigation, accessible focus behavior, and reduced-motion support.

### Data collection

- Replaced unrestricted catalog fan-out with global and per-origin collection budgets and round-robin origin scheduling.
- Added per-provider source health, truth basis, data-quality scoring, source host, request latency, attempt counts, freshness, incident count, maintenance count, and component-issue count.
- Added a top-level collection-run contract with run ID, pipeline version, duration, origin and source counts, request success, median and p95 latency, quality score, and healthy/watch/blind source distribution.
- Preserved free, unauthenticated, first-party-only collection with no API keys, credentials, paid services, commercial aggregators, crowdsourced data, or browser-side vendor calls.

### Validation and UX safety

- Added server and browser validation for the collection intelligence contract and reconciliation of provider, request, source-health, and quality metrics.
- Kept service state and source health independent so a collector failure cannot become an outage or an operational confirmation.
- Added deterministic tests for origin budgets, quality scoring, collection metrics, action prioritization, source-health filtering, and category reconciliation.

## [2.5.1] - 2026-07-31

### Fixed

- Fixed recurring same-title maintenance windows producing duplicate IDs that caused the deployed browser validator to reject the entire payload.
- Added deterministic maintenance identity based on the vendor ID when available, otherwise the normalized title, maintenance window, and official source URL.
- Added global maintenance deduplication that merges repeated updates into one bounded timeline.
- Added maintenance validation parity to the server-side generator so duplicate IDs, invalid states, timestamps, providers, or URLs fail before publication.

### Deployment safety

- Added the exact browser payload validator as a mandatory pre-deployment check.
- Added deployed HTML, JavaScript, CSS, and status-payload smoke checks after GitHub Pages publication.
- Added a headless-browser render assertion before the deployment success marker is published.

## [2.5.0] - 2026-07-31

### Added

- Added a separate maintenance-intelligence model for scheduled and in-progress work, including affected services, start/end times, official links, and bounded provider update timelines.
- Added source-evidence tiers, confidence labels, parser versions, structural schema fingerprints, schema-change warnings, last successful retrieval, consecutive failure streaks, and last semantic-change timestamps.
- Added component-level state capture for supported structured sources and surfaced component problems in provider diagnostics.
- Added lifecycle events for source schema drift, repeated retrieval failures, and maintenance announcement, start, update, and completion.
- Added operator and wallboard metrics for maintenance, high-confidence sources, structured sources, schema changes, failure streaks, and component issues.
- Added deterministic regression tests for source fingerprints, confidence semantics, reliability history, maintenance separation, and lifecycle changes.

### Changed

- Enabled the verified first-party Statuspage JSON adapter for every existing catalog provider whose vendor-owned structured endpoint was already documented in the source matrix.
- Preserved up to eight current vendor incident or maintenance updates rather than showing only the newest sentence.
- Separated planned maintenance from active incidents so routine work remains visible without inflating outage counts; maintenance that escalates to active customer impact remains an incident.
- Expanded retained lifecycle history from 100 to 200 bounded records.
- Added structural parser canaries that distinguish source-shape changes from ordinary incident wording changes and fail closed when a structured source becomes unreadable.
- Kept the product static and free: no API keys, credentials, authenticated tenant access, commercial aggregators, crowdsourced outage data, or browser-side vendor calls were introduced.

## [2.4.0] - 2026-07-31

### Added

- Added first-party structured adapters for Atlassian Statuspage JSON, Better Stack public status JSON, and rendered Status.io pages.
- Added lifecycle, affected-component, official incident-link, first-detected, and latest-update extraction for structured incident records.
- Added source-adapter labels in provider diagnostics and incident-stage labels on incident cards.
- Enabled verified Statuspage JSON handling for Cloudflare, OpenAI, Anthropic, SentinelOne, DNSFilter, NinjaOne, Cisco Meraki, DigitalOcean, Zoom, 1Password, Duo, Huntress, Twilio, Discord, and Notion.

### Changed

- Moved selected existing providers from broad HTML interpretation to their official public Statuspage JSON summaries.
- Moved SuperOps to its official public Better Stack JSON document.
- Added component and location-aware Status.io parsing for ConnectWise and HaloPSA.
- Kept scheduled maintenance, resolved incidents, editorial content, generic headings, and explicitly non-US-only incidents out of active incident output.
- Made malformed or non-operational structured responses without a usable incident record fail closed.

## [2.3.9] - 2026-07-31

### Fixed

- Replaced generic incident headings with actual provider incident titles, current details, affected services, regional scope, and timestamps where the official source exposes them.
- Moved N-able monitoring from its release-news site to the official uptime dashboard and rejected marketing, release-note, and quarterly wrap-up posts.
- Split N-able and Cove incidents by affected product so unrelated N-central and Cove records cannot contaminate each other.
- Treated active incidents and planned maintenance as separate bounded N-able records, and reused one shared uptime-page request for N-able and Cove.
- Applied title-first US regional filtering so international-only Cisco Umbrella, Cloudflare, and other incidents are not retained because of unrelated page boilerplate.
- Added truthful parsers for Cloudflare, Docker, Cisco Umbrella, N-able, and Cove, and made inconclusive generic HTML fail closed instead of publishing fabricated incident text.

## [2.3.8] - 2026-07-31

### Added

- Expanded the footer helper with basic site information, regional-scope rules, status meanings, refresh behavior, data limitations, view links, and project links.
- Added a regression test requiring the newest changelog version to match `package.json`.

### Clarified

- Regional filtering is US-first and applies to incident notices, not the provider catalog.
- US, North America, global, worldwide, mixed-region incidents that include the US, and incidents with no region stated remain visible.
- Incidents explicitly limited to the UK, EU, EMEA, APAC, or another non-US region are hidden by default.
- Live-source coverage measures readable current sources. It does not mean that the same percentage of providers is operational.

## [2.3.7] - 2026-07-31

### Changed

- Filtered routine scheduled-maintenance notices while retaining emergency work and maintenance that escalates to active customer impact.
- Increased scheduled payload generation from every 30 minutes to every 12 minutes and added a five-minute deployment-age gate.
- Consolidated Datto into Kaseya and explicitly included Autotask PSA, Datto RMM, Datto BCDR, Datto SaaS Protection, Kaseya VSA, and Kaseya BMS.
- Added US-first incident filtering while retaining global, mixed-region, and region-unspecified notices.
- Added structured Okta incident timestamps and deduplicated repeated incident updates while preserving first detection and latest update times.

## [2.3.6] - 2026-07-31

### Changed

- Removed eight providers that had no acceptable free public source.
- Repaired 14 public-source integrations using free first-party pages, feeds, or rendered public dashboards.
- Reduced the active catalog to 79 providers and improved readable live-source coverage to 94 percent at release validation.

## [2.3.5] - 2026-07-31

### Changed

- Moved Entra ID to Microsoft Azure's public RSS feed with identity-specific incident filtering.
- Treated readable official history feeds as live source access without falsely concluding that the service is operational.
- Improved incident-term detection for degradation, investigation, and failure wording.

## [2.3.4] - 2026-07-31

### Removed

- Removed obsolete temporary workflows and dead AT&T, Cox, and Comcast Business code paths.

### Fixed

- Synchronized package metadata and lockfile versions.

## [2.3.3] - 2026-07-31

### Fixed

- Corrected browser payload validation so live-source coverage and structural record validity are treated as separate metrics.
- Prevented valid limited-source payloads from being rejected as coverage-count mismatches.

## [2.1.6] - 2026-07-23

### Added

- Added full-viewport Heads Up, All Providers, and Source Health wallboard screens.
- Added URL-controlled screen, density, and rotation settings, exact provider pagination, fullscreen, optional Wake Lock, and reduced-motion handling.
- Added current, generated, and check times with explicit 40-minute warning and 60-minute critical stale states.
- Added complete provider identification across incident and diagnostic views.
- Preserved bundled brand marks and generated deterministic local monogram icons for every remaining provider.

### Changed

- Separated explicit service, source, and technician-attention states with reconciled schema-v2 summaries and comprehensive validation.
- Added bounded streaming reads, content-type enforcement, transient retry diagnostics, and future-timestamp protection.
- Added change detection, operational briefing, MSP impact guidance, communication drafts, advanced filters, and persistent wallboard and operator modes.
- Made React request ownership Strict Mode safe and replaced the frozen countdown with visibility-aware stable wording.
- Split restricted Pages build and deploy permissions and expanded deterministic coverage to fetching, payloads, summaries, changes, lifecycle, and UI models.

## [2.1.5] - 2026-07-23

### Added

- Added explicit status-data lifecycle with stale retention and false-green prevention.
- Added responsive, accessible incident and filterable provider diagnostics with provider logos.
- Added deterministic lifecycle, view-model, and parser tests.

### Changed

- Hardened schema validation, portable paths, bounded responses, and atomic status publication.
- Consolidated Pages deployment, removed the cron probe, and centralized version metadata.
