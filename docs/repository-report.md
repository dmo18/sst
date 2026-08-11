# Repository architecture report

Status: current production architecture
Updated: 2026-08-11
Final implementation commit: `357021b38a955b402af03d35415d1c1eae2a1550`

## Product and trust model

This repository builds a static MSP operations command center from free first-party public sources owned by monitored vendors. The canonical production catalog contains 80 active providers across 31 categories. Catalog membership and identity are derived rather than hardcoded.

The product has three independent but connected layers:

1. **truth and collection architecture** - determines what can safely be concluded from official provider evidence;
2. **operator product architecture** - provides command, investigation, local workflow, search, replay, lenses, provider recognition, and Microsoft 365 operating context without changing service truth;
3. **wallboard/signage architecture** - provides the exact compact heads-up display while remaining isolated from operator-only product layers.

The system remains fail closed:

- a source failure is not a vendor outage;
- a parser canary/quarantine is not a vendor outage;
- a reliability SLO breach is not a vendor outage;
- missing data cannot become a healthy service conclusion;
- routine maintenance, resolved history, marketing content, and collector failures cannot become active incidents;
- browser code validates the public wire contract before rendering it;
- browser-local operator actions cannot rewrite vendor truth;
- temporal correlation never becomes a causality claim.

No customer, tenant, ticket, device, user, credential, paid status feed, third-party outage aggregator, runtime logo CDN, or browser-side vendor collection is part of the public Pages application.

## Canonical data path

```text
config/providers.json
  + config/provider-consolidation.json
  -> 80-provider canonical active catalog
  -> deterministic catalog hash
  -> bounded first-party source retrieval
  -> structured adapters / registry-backed current-page adapter SDK
  -> fail-closed internal draft
  -> source + collection intelligence
  -> 7-day + 30-day reliability
  -> parser canary + bounded quarantine
  -> internal validation
  -> Status Contract v3 envelope
  -> public/status.json
  -> shared browser wire validation
  -> usePayloadPoller
  -> operator command center / product-depth layer / wallboard
  -> serialized GitHub Pages release
```

The public wire envelope publishes `schema_version: 3`, `contract_version: 3`, and the canonical catalog hash. Browser validation, release validation, and production smoke require the same identity.

## Runtime product architecture

### Application composition

- `src/App.tsx` - route composition and high-level operator/wallboard selection.
- `src/usePayloadPoller.ts` - bounded browser retrieval, overlap prevention, wire validation, freshness, cadence, visibility recovery, and successful-check telemetry.
- `src/IssueConsole.tsx` - primary operator workspace and canonical five-destination navigation state.
- `src/ExperienceLayer.tsx` - live operational pulse, state-aware root tone, and Command/Ctrl + K launcher.
- `src/ProductDepthLayer.tsx` - Dependency Universe, universal search, change catch-up, watchlist/lenses, provider focus, and Incident Focus.
- `src/ProductDepthLauncher.tsx` - persistent discoverability for the signature operator surface.
- `src/operatorWorkspace.ts` - browser-local workflow records, search index, change digest, lenses, dependency graph, and handoff generation.
- `src/Microsoft365CriticalSuite.tsx` - explicit Microsoft 365 critical-service operating context and public-vs-tenant evidence boundary.
- `src/OperationsIntelligencePanel.tsx` - source reliability, SLO/canary, and incident-correlation intelligence.
- `src/WallboardV2.tsx` - sole React wallboard implementation.
- `src/statusViewModel.ts` - operator/action-queue model derived from validated truth.
- `src/wirePayloadValidation.ts` - public Status Contract v3 validation.
- `src/providerCatalog.ts` - canonical provider identity and stable catalog hash.
- `src/providerIcon.tsx` + `src/logos.ts` - local provider-recognition system.

### Operator command system

The product-depth system is operator-only and does not mount in wallboard mode.

It provides:

- browser-local acknowledgement, follow, snooze, handled state, assignee, and notes;
- Incident Focus with vendor timeline, evidence, technician guidance, client-safe draft, handoff, and deep link;
- Dependency Universe with category/provider topology and cautious temporal-correlation edges;
- Signal Replay from bounded recorded changes only;
- Command/Ctrl + Shift + K universal search across incidents, providers, maintenance, correlations, categories, and changes;
- since-last-review catch-up intelligence;
- pinned providers and saved browser-local lenses;
- shareable `focus=` and `lens=` state.

Local workflow state is explicitly non-authoritative and cannot modify `service_state`, `source_state`, `source_health`, evidence, parser state, or release validation.

### Microsoft 365 critical suite

Microsoft 365 is represented as ten explicit critical service facets rather than one generic provider row. The operating surface covers major Microsoft cloud workloads and dependencies, including Exchange Online, Teams, SharePoint Online, OneDrive, Entra ID, and Microsoft 365 administration/service-health context.

The truth boundary is explicit:

- broad public Microsoft status is public evidence;
- Entra receives dedicated public evidence where available;
- tenant-complete Microsoft 365 service health requires authenticated Microsoft Graph service communications with `ServiceHealth.Read.All`.

The public static application does not infer tenant health that Microsoft exposes only through authenticated tenant context.

### NUSO

NUSO is a first-class high-criticality VoIP/communications provider with public source `https://status.nuso.cloud/api/v2/summary.json`.

Its canonical operating scope includes UCaaS, NUSO Bridge for Teams, NUSO Bridge for Zoom, Microsoft Operator Connect, inbound/outbound voice, messaging/SMS/MMS, emergency services, network, portals, and CPaaS/API surfaces.

NUSO uses the normal Statuspage adapter/history path and participates in catalog hashing, live collection, Status Contract validation, search, Dependency Universe, provider operations, and deployed visual evidence.

### Provider-recognition architecture

Provider identity is local and deterministic. No runtime favicon or logo CDN request is allowed.

The final implementation has:

- 80/80 active providers with curated identities;
- 45 local exact/brand-geometry provider references;
- 43 unique exact bundled assets because some related providers intentionally share a parent brand mark;
- 35 exact masked marks in the deployed provider table;
- 35 provider-specific embedded SVG recognition aids for vendors without stable exact geometry in the pinned source set;
- unknown-provider initials only as the final fallback.

Where appropriate, exact geometry is pinned from Simple Icons 16.27.1 and bundled locally. Existing stronger local marks remain for Microsoft, Google, AWS, Cloudflare, OpenAI, Anthropic, Slack, and Zoom. `public/assets/logos/BRAND-SOURCES.md` records the source/license boundary and explicitly distinguishes exact sourced marks from brand-inspired recognition aids.

`scripts/verify-provider-identity.mjs` drives the deployed provider surface through CDP and requires:

- structural readiness of the 80-provider table;
- NUSO identity and logo;
- at least 35 exact masked marks;
- at least 45 local exact-logo references;
- no more than 35 generated identities;
- embedded local SVG count equal to rendered generated-identity count;
- no unexpected embedded data type;
- no external logo origin;
- successful fetch of every referenced exact local asset;
- no desktop/mobile horizontal overflow;
- NUSO intentionally visible in the 390x844 mobile evidence frame.

A permanent `node --check` regression prevents syntactically invalid browser verifiers from merging.

## Premium visual architecture

The premium style stack is loaded before wallboard geometry and includes the base command-center/density layers, premium experience/interactions/icons/state/mobile/final-polish layers, product-depth styles, Microsoft 365 treatment, provider identity, and then the authoritative wallboard stack.

The visual system provides larger typography, state-aware atmosphere, elevated surfaces, coherent navigation icons/product mark, keyboard focus/selection, reduced-motion handling, responsive mobile composition, and application-chrome placement for persistent controls.

Human screenshot review remains part of acceptance. It previously caught posture grammar, desktop overlap, mobile control collision, weak secondary contrast, and mobile Dependency Universe scale/replay overlap that automated geometry checks alone did not catch.

## Wallboard architecture

Wallboard files load last so signage geometry wins the cascade:

1. `src/styles/wallboard-v2.css` - normal wallboard structure and geometry.
2. `src/styles/wallboard-compat.css` - unlayered pre-Cascade-Layers structural fallback.
3. `src/styles/wallboard-tv.css` - exact compact 458x291 tuning.
4. `src/styles/wallboard-premium.css` - visual-only atmosphere and surface polish.

Operator product-depth and provider-identity layers are forbidden from taking over wallboard geometry.

## Source adapters, reliability, and evidence

Current-page provider-specific conclusions flow through `scripts/public-source-repairs.mjs`, the registry facade over `scripts/source-adapter-sdk.mjs` and its isolated implementation.

The SDK owns registered adapter identity, accepted result kinds, stable provider-scoped fallback incident identity, current-page provenance defaults, and normalized producer-boundary behavior.

Vendor-timed incidents remain distinct from current-page observations. `observed_at` does not become a synthetic vendor incident start time.

Every provider publishes bounded seven-day and thirty-day observation windows. Parser canaries publish stable/changed observation state plus bounded `clear`, `observing`, or `quarantined` lifecycle. Quarantine can reduce source trust but cannot modify vendor service truth.

Active-event correlation is browser-derived from accepted vendor-timed incidents only and is explicitly non-causal.

## Security posture

- restrictive CSP in the static application;
- local application and provider-identity assets;
- same-origin status retrieval;
- no browser-side vendor collection;
- no runtime logo CDN/favicon requests;
- immutable current GitHub Action SHAs;
- CodeQL v4 for JavaScript/TypeScript;
- complete high-severity dependency auditing;
- Dependabot for npm and GitHub Actions;
- repository-owned quality/formatting gates and opt-in pre-commit hook;
- checkout credentials not persisted;
- live vendor collection explicitly removes `GITHUB_TOKEN` and `GH_TOKEN`;
- untrusted vendor-page rendering uses sandboxed Chromium with disposable profiles;
- Pages/OIDC/status write permissions are isolated to the deploy job.

## Release architecture

Pages releases remain serialized with `cancel-in-progress: false`.

Code-changing releases perform provider validation, quality, deterministic tests, TypeScript, complete dependency audit, token-free live collection, Status Contract/catalog validation, release reconciliation, application build, verified shell publication, Pages deployment, production smoke, current-browser render, pinned pre-Cascade-Layers Chromium wallboard render, exact current-Chromium 458x291 Yodeck verification, artifact upload, and deployed intelligence publication.

Scheduled live-data refreshes reuse the verified shell for the exact same commit and skip unchanged code verification/build work when the artifact is present. They still run live collection, wire/release validation, deployment, smoke, current-browser rendering, exact Yodeck verification, and status publication.

## Post-deploy product evidence

`.github/workflows/product-experience.yml` runs after successful non-scheduled releases and exercises four deployed surfaces:

1. premium desktop/command/mobile operator experience;
2. product-depth Dependency Universe/search/Incident Focus/mobile;
3. Microsoft 365 desktop/mobile critical coverage and evidence boundary;
4. provider identity/NUSO desktop/mobile recognition and asset-origin contract.

All screenshot artifacts are retained for human review.

## Final implementation evidence

Final implementation commit: `357021b38a955b402af03d35415d1c1eae2a1550`.

Production release #833 (`31539557831`) passed the full repository, live-data, deployment, current-browser, legacy-browser, exact Yodeck, artifact, and status-publication path.

Main CodeQL #125 (`31539557679`) passed on the same commit.

Product-experience #34 (`31539671901`) passed all four deployed product gates and uploaded artifact `9120182392` with digest `sha256:8c1ea4cec9cc783ba63a9c776e4629309664474f683acfe518d332b8b6edfaab`.

The evidence records:

- 1440x960 premium desktop, 281px hero, 46.08px headline, 15 live commands with real keyboard selection movement;
- Dependency Universe with 80 providers / 31 categories, universal search, live Incident Focus, and 390x844 product-depth mobile;
- Microsoft 365 ten-facet critical suite with public-vs-private tenant-health boundary;
- provider recognition with 80 providers, 35 exact masks, 35 embedded curated identities, 45 local exact-logo references, 43 unique exact assets, no external logo origins;
- NUSO present and visible in the mobile provider evidence frame.

The final provider screenshots were manually inspected. Desktop presents a coherent, scan-friendly provider estate; the mobile frame centers NUSO cleanly with identity, category, service/source state, and quality visible without overlap or horizontal clipping.

See `docs/product-depth-command-system.md` for the product-depth completion record, `docs/product-experience-overhaul.md` for the premium visual overhaul, and `docs/architecture-reconciliation.md` for the underlying collection/truth reconciliation.