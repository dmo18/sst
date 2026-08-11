# Repository architecture report

Status: current premium production architecture
Updated: 2026-08-10

## Product and trust model

This repository builds a static MSP operations command center from free first-party public sources owned by monitored vendors. The production catalog currently contains 80 raw entries and 79 active providers after consolidation. Catalog membership is derived, not hardcoded.

The product has two independent but connected layers:

1. **truth and collection architecture** - determines what can safely be concluded from official provider evidence;
2. **premium product experience** - turns that validated model into an operator command center, mobile workspace, and signage surface without changing service truth.

The system remains fail closed:

- a source failure is not a vendor outage;
- a parser canary or quarantine is not a vendor outage;
- a reliability SLO breach is not a vendor outage;
- missing data cannot become a healthy service conclusion;
- routine maintenance, resolved history, marketing content, and collector failures cannot become active incidents;
- browser code validates the public wire contract before rendering it.

No customer, tenant, ticket, device, user, credential, authenticated vendor API, paid status feed, or third-party outage aggregator is part of the public Pages application.

## Canonical data path

```text
config/providers.json
  + config/provider-consolidation.json
  -> canonical active provider catalog
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
  -> React operator command center / wallboard
  -> serialized GitHub Pages release
```

The public wire envelope publishes `schema_version: 3`, `contract_version: 3`, and the canonical catalog hash. Browser validation, release validation, and production smoke require the same identity.

## Runtime product architecture

### Application composition

- `src/App.tsx` - route composition and high-level operator/wallboard selection.
- `src/usePayloadPoller.ts` - bounded browser retrieval, overlap prevention, wire validation, freshness, cadence, visibility recovery, and successful-check telemetry.
- `src/IssueConsole.tsx` - primary operator workspace and canonical navigation state.
- `src/ExperienceLayer.tsx` - live operational pulse, state-aware root tone, and `Command/Ctrl + K` launcher layered on the canonical navigation contract.
- `src/OperationsIntelligencePanel.tsx` - source reliability, SLO/canary, and incident-correlation intelligence.
- `src/WallboardV2.tsx` - sole React wallboard implementation.
- `src/statusViewModel.ts` - operator/action-queue model derived from validated truth.
- `src/wirePayloadValidation.ts` - public Status Contract v3 validation.
- `src/providerCatalog.ts` - canonical provider identity and stable catalog hash.

### Premium operator style stack

Operator styling is deliberately layered before wallboard geometry:

1. `src/styles/command-center.css` - base shared/operator primitives.
2. `src/styles/ultra-hd.css`, `mobile-ops.css`, `ultra-hd-tuning.css` - existing density/responsive foundation.
3. `src/styles/premium-experience.css` - premium tokens, hierarchy, atmospheric surfaces, hero, metrics, tables, drawers, command palette, and intelligence treatment.
4. `src/styles/premium-interactions.css` - motion, focus, hover, press, scrollbars, and keyboard-selected command states.
5. `src/styles/premium-icons.css` - dependency-free abstract product mark and coherent masked navigation icon family.
6. `src/styles/premium-state.css` - validating/healthy/warning/critical ambient response derived from the trusted operating model.
7. `src/styles/premium-mobile.css` - authoritative phone layout below 900px.
8. `src/styles/premium-final-polish.css` - production screenshot-review corrections, desktop chrome docking, mobile topbar Intelligence placement, and final contrast/composition fixes.

### Wallboard style stack

Wallboard files load after the premium operator layers so signage geometry wins the cascade:

1. `src/styles/wallboard-v2.css` - normal wallboard structure and geometry.
2. `src/styles/wallboard-compat.css` - unlayered pre-Cascade-Layers structural fallback.
3. `src/styles/wallboard-tv.css` - exact compact 458 by 291 presentation tuning.
4. `src/styles/wallboard-premium.css` - visual-only atmosphere and surface polish.

`wallboard-premium.css` is intentionally forbidden from taking over dimensions, grid geometry, marquee timing, or compact presentation ownership.

## Command experience

`ExperienceLayer.tsx` does not introduce a second router or operational state model. It dispatches through the same keyboard/navigation contract already owned by the operator console.

The launcher:

- opens with `Command/Ctrl + K`;
- promotes current incident signals;
- exposes the canonical five operator destinations plus Wallboard and Refresh;
- supports Up, Down, Enter, Esc, and mouse-hover synchronization;
- reports live incident, blind-spot, and coverage context;
- adapts the displayed shortcut for Mac versus Windows/Linux.

Persistent live pulse and Intelligence controls are part of application chrome, not floating content overlays.

## Mobile architecture

The phone experience is explicitly productized below 900px:

- five fixed bottom destinations;
- sticky topbar and lifecycle strip;
- compact topbar Intelligence action beside Refresh;
- responsive hero and summaries;
- two-column metrics;
- provider rows reflowed into touch-friendly cards;
- phone-specific incidents/timeline;
- full-screen provider drawer;
- safe-area-aware navigation spacing;
- desktop live pulse hidden.

## Source adapters and evidence

Current-page provider-specific conclusions flow through `scripts/public-source-repairs.mjs`, the registry facade over `scripts/source-adapter-sdk.mjs` and the isolated implementation module.

The SDK owns:

- registered adapter identity;
- accepted result kinds;
- stable provider-scoped fallback incident identity;
- current-page provenance defaults;
- normalized producer-boundary behavior before conclusions reach payload construction.

Vendor-timed incidents remain distinct from current-page snapshot observations. `observed_at` does not become a synthetic vendor incident start time.

## Reliability, canaries, and correlation

Every provider publishes bounded seven-day and thirty-day observation windows. SLO states remain `warming`, `meeting`, `watch`, and `breach`.

Parser canaries publish observation state plus a bounded `clear`, `observing`, or `quarantined` lifecycle. Quarantine can reduce source trust but cannot modify vendor `service_state`, accepted incident severity, component state, or a successful transport observation.

Active-event correlation is browser-derived from accepted vendor-timed incidents only and is explicitly non-causal.

## Security posture

- restrictive CSP in the static application;
- local application assets and same-origin status retrieval;
- no browser-side vendor collection;
- immutable GitHub Action SHAs;
- current action generations;
- CodeQL v4 for JavaScript/TypeScript;
- complete high-severity dependency auditing;
- Dependabot for npm and GitHub Actions;
- repository-owned quality and formatting gates;
- opt-in pre-commit hook;
- checkout credentials not persisted;
- live vendor collection explicitly removes `GITHUB_TOKEN` and `GH_TOKEN`;
- untrusted vendor-page rendering uses sandboxed Chromium with disposable profiles;
- Pages/OIDC/status write permissions are isolated to the deploy job.

## Release architecture

Pages releases remain serialized with `cancel-in-progress: false`.

Code-changing releases perform the complete path:

1. provider validation;
2. repository quality gates;
3. deterministic tests;
4. TypeScript;
5. complete dependency audit;
6. token-free live collection;
7. Status Contract v3/catalog-hash validation;
8. release reconciliation;
9. application build;
10. verified commit-keyed application-shell publication;
11. Pages deployment;
12. production smoke;
13. current-browser operator render;
14. pinned pre-Cascade-Layers Chromium wallboard render;
15. exact current-Chromium 458 by 291 Yodeck verification;
16. evidence/status publication.

Scheduled live-data refreshes reuse the verified shell for the exact same commit and skip unchanged code verification/build work when the artifact is present. They still run live collection, wire/release validation, deployment, production smoke, current-browser rendering, exact Yodeck verification, and status publication.

## Product-experience release evidence

`.github/workflows/product-experience.yml` is a post-deploy visual/product gate for successful non-scheduled releases.

`scripts/verify-operator-experience.mjs` exercises the deployed application through CDP and requires:

- 1440 by 960 desktop composition;
- premium tokens and state-aware atmosphere;
- materially large posture hero/headline;
- no desktop horizontal overflow;
- command palette opening with focused search;
- real keyboard command selection movement;
- 390 by 844 mobile composition;
- fixed five-destination bottom navigation;
- no mobile horizontal overflow;
- no desktop pulse on mobile.

It captures desktop overview, open command palette, mobile operator, rendered HTML, and a verifier log as retained artifacts.

Cleanup failures cannot mask product failures. The workflow uses ordinary pipefail semantics, and Chromium profile cleanup is handled inside the verifier after all product assertions and screenshots have completed.

## Legacy signage verification

`scripts/verify-legacy-wallboard.mjs` uses CDP rather than the brittle old `--dump-dom` serializer.

The gate requires the running pinned legacy Chromium to:

- activate `no-css-layers`;
- render the wallboard shell and operational content;
- use the exact 458 by 291 viewport;
- fill the expected wallboard geometry;
- avoid horizontal overflow;
- avoid application errors;
- produce a non-trivial screenshot.

The compatibility browser's `--no-sandbox` exception is limited to this repository's already-deployed static application. Untrusted vendor collection remains separately sandboxed.

## Final production evidence

Premium product baseline: `f1ad5df7d651212f2c699a8c16e9dc253ede6245`.

Production run #799 (`31454693471`) passed the full repository, live-data, deployment, current-browser, legacy-browser, exact Yodeck, artifact, and status-publication path.

Product-experience run #6 (`31454777612`) then passed desktop, command, and mobile browser assertions and uploaded clean evidence artifact `9087617756` with digest `sha256:a3e9af7af18002a734dda06a968291a8ee5d589ef3c91932fafa3271f2da0e0b`.

The retained evidence records 1440 by 960 desktop, 281px posture hero, 46.08px headline, 11 live commands in the tested operating state, real keyboard movement between incident commands, and a 390 by 844 mobile surface.

Human screenshot review was part of acceptance. It found and drove fixes for posture grammar, desktop content overlap, weak secondary contrast, mobile control collision, and persistent-control composition before the final state was accepted.

See `docs/product-experience-overhaul.md` for the complete product redesign and visual-review record and `docs/architecture-reconciliation.md` for the underlying truth/collection architecture reconciliation.