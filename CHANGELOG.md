# Changelog

All notable changes to the Service Heads-Up Console are recorded here.

The project uses semantic versioning. Dates are shown in ISO format. The newest released version must match `package.json`.

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
