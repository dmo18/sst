# Product-depth command system

Status: complete
Started: 2026-08-11
Completed: 2026-08-11
Original base: `f9a8d62d8fcfa32f9fb77852103ac4d208fc36be`
Final implementation commit: `357021b38a955b402af03d35415d1c1eae2a1550`

## Why this phase existed

The premium visual redesign fixed presentation but did not create enough product depth. ServiceOps still behaved primarily as a polished monitoring console: operators could inspect, navigate, filter, and copy information, but the application did not provide a strong browser-local action loop, a memorable dependency exploration surface, universal search, explicit catch-up intelligence, reusable personal lenses, first-class Microsoft 365 coverage, or a strong provider-recognition system.

This phase closes that gap without pretending the current static GitHub Pages architecture has shared server-side collaboration or tenant credentials.

## Shipped product contract

### Operator workflow state

ServiceOps supports browser-local operator workflow state for acknowledgement, follow state, 30-minute snooze, locally handled state, assignee text, operator notes, pinned providers, saved provider lenses, and the last explicitly reviewed payload.

This state is never vendor truth. It cannot alter `service_state`, `source_state`, `source_health`, evidence, source confidence, parser state, or release validation. The UI and handoff bundle label the state as browser-local.

### Incident Focus

Active incidents open a dedicated incident room with vendor identity and priority, vendor timeline, MSP impact, technician guidance, client-safe draft language, source trust/evidence quality, cautious temporal correlation context, browser-local actions, assignee/notes, copyable handoff, and shareable deep links.

### Dependency Universe

The signature product surface is an interactive dependency field:

- service categories act as gravity hubs;
- monitored providers orbit their category;
- service/source posture drives node tone;
- high-criticality, affected, pinned, and replayed nodes receive stronger visual treatment;
- cautious vendor-timed correlations become distinct edges;
- correlation language remains temporal only and never claims causality;
- saved lenses can isolate a selected provider estate.

The mobile composition was production-screenshot reviewed and corrected so the graph materially fills the phone canvas and the replay evidence boundary does not overlap replay controls.

### Signal Replay

Replay uses bounded recorded `StatusChange` history only. It highlights recorded provider changes over time. It does not reconstruct historical service state that was never observed, and that evidence boundary remains visible even when change history is present.

### Universal search and catch-up

Command/Ctrl + Shift + K searches one index spanning active incidents, providers, maintenance, temporal correlations, service categories, and bounded change history. Search results open shareable investigation targets.

The catch-up surface compares bounded recorded changes against the last payload the operator explicitly marked as reviewed and summarizes new incidents, recoveries, source changes, maintenance changes, and severity changes. Hidden or unobserved events are not inferred.

### Personal lenses

Operators can pin providers and save the pinned set as a named browser-local lens. A lens can be opened in Dependency Universe and carried in URL state.

## Microsoft 365 critical coverage

Microsoft 365 is treated as a critical suite rather than one generic provider tile. The product exposes ten service facets covering the major Microsoft cloud operating surface, including Exchange Online, Microsoft Teams, SharePoint Online, OneDrive, Microsoft Entra ID, Microsoft 365 administration/service health, and related collaboration/identity dependencies.

The evidence boundary is explicit:

- public Microsoft status provides broad public evidence;
- Entra receives dedicated public-source evidence where available;
- tenant-complete Microsoft 365 service health requires authenticated Microsoft Graph service communications with `ServiceHealth.Read.All` and is not fabricated by the public Pages application.

The deployed browser verifier requires this boundary on desktop and mobile.

## NUSO coverage

NUSO is a first-class high-criticality VoIP/communications provider using its public Atlassian Statuspage source at `https://status.nuso.cloud/api/v2/summary.json`.

The canonical service scope includes UCaaS, NUSO Bridge for Teams, NUSO Bridge for Zoom, Microsoft Operator Connect, inbound/outbound voice, messaging/SMS/MMS, emergency services, network, portals, and CPaaS/API surfaces.

NUSO uses the normal first-party Statuspage adapter and history feeds. It participates in live collection, catalog hashing, Status Contract validation, search, Dependency Universe, provider operations, wallboard/release contracts, and deployed desktop/mobile provider evidence.

## Provider-recognition system

Every active provider now has a curated recognition identity. The final implementation has:

- 80 active providers;
- 45 local exact/brand-geometry provider references across 43 unique bundled assets;
- 35 exact masked marks in the deployed provider table;
- 35 provider-specific embedded recognition SVGs for vendors without a stable exact mark in the pinned source set;
- deterministic initials only as an unknown-provider fallback;
- no runtime logo CDN, favicon request, or external logo origin.

Exact sourced geometry and provider-specific recognition aids are deliberately distinguished. Custom long-tail tiles use curated label, brand-family color, and motif but are not represented as official vendor artwork.

The pinned open geometry source is Simple Icons 16.27.1 where appropriate, alongside stronger existing locally built marks for Microsoft, Google, AWS, Cloudflare, OpenAI, Anthropic, Slack, and Zoom. Source attribution and the exact-vs-recognition distinction are recorded in `public/assets/logos/BRAND-SOURCES.md`.

## Discoverability

The command system is reachable through the persistent Dependency Universe chrome launcher, `G`, Command/Ctrl + K, Command/Ctrl + Shift + K, live incident commands that open Incident Focus directly, and shareable `focus=` / `lens=` URL state.

## Static-product boundary

This repository remains a public static GitHub Pages application. It does not fake shared team state, authentication, server-side comments, external ticket creation, Slack/Teams delivery, PagerDuty actions, PSA writes, or tenant-specific Microsoft Graph data. Those capabilities require an authenticated private backend and explicit private-data architecture.

## Implementation and acceptance record

Key merged changes:

- PR #120 - core product-depth command system, local operator action model, search, catch-up, lenses, Incident Focus, Dependency Universe, replay, and deep links.
- PR #121 - structural legacy-browser readiness verification.
- PR #123 - permanent replay evidence boundary and Microsoft 365 critical suite/deployed verifier.
- PR #124 - mobile Dependency Universe screenshot-review correction and evidence cleanup proof.
- PR #125 - NUSO first-class source plus all-provider recognition system.
- PR #126 - five additional exact brand geometries, bringing local exact/brand geometry to 45 provider references.
- PR #127 - CDP structural provider/NUSO deployed verifier.
- PR #128 - permanent `node --check` guard for the provider browser verifier.
- PR #129 - correct classification of embedded local recognition SVGs versus network-external logo references.

Final implementation production evidence:

- commit: `357021b38a955b402af03d35415d1c1eae2a1550`;
- production release #833 (`31539557831`) - complete repository/build/live-data path, GitHub Pages deployment, current Chromium, pinned pre-Cascade-Layers Chromium, exact 458x291 Yodeck, artifacts, and deployed intelligence publication all passed;
- main CodeQL #125 (`31539557679`) - passed on the same final implementation commit;
- product experience #34 (`31539671901`) - premium operator, product-depth, Microsoft 365, provider identity/NUSO, and artifact upload all passed;
- final evidence artifact `9120182392`, digest `sha256:8c1ea4cec9cc783ba63a9c776e4629309664474f683acfe518d332b8b6edfaab`.

Product experience #34 recorded:

- Dependency Universe: 80 providers across 31 categories;
- live Incident Focus verification;
- 390x844 product-depth mobile verification;
- Microsoft 365: 10 critical facets and the public-vs-private evidence boundary;
- provider identity: 80 providers, 35 exact masks, 35 curated embedded SVG identities, 45 local exact-logo references, 43 unique exact assets;
- NUSO present in the deployed provider model and intentionally visible in the mobile evidence frame;
- no external logo loading.

The retained desktop and mobile provider screenshots were manually reviewed. Desktop presents a scan-friendly recognizable provider estate, and the mobile evidence shows NUSO identity/status/source/quality without overlap or horizontal clipping.

## Completion rule

The final implementation commit is the production/evidence target. Documentation-only closure commits may change the repository SHA but do not invalidate the browser evidence for the unchanged product implementation; they are separately required to pass normal repository checks, CodeQL, and the production release path.

All product-depth completion gates are satisfied for the final implementation commit.