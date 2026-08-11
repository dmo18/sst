# Repository architecture report

Status: current reconciled architecture
Updated: 2026-08-10

## Product and trust model

This repository builds a static MSP operations command center from free first-party public sources owned by monitored vendors. The current catalog contains 80 raw entries and 79 active providers after consolidation. Those numbers are descriptive observations, not validation constants; active membership is derived from the raw catalog, exclusions, and overrides.

The system fails closed:

- A source failure is not a vendor outage.
- A parser canary or parser quarantine is not a vendor outage.
- A source-reliability SLO breach is not a vendor outage.
- A readable but limited source is not operational confirmation.
- Missing data cannot produce a green conclusion.
- Routine maintenance, resolved history, marketing posts, release notes, generic headings, and collector errors do not become active incidents.
- Public browser code validates the complete wire contract independently before rendering it.

No customer, tenant, ticket, device, user, credential, authenticated vendor API, paid status feed, or third-party outage aggregator is part of the public Pages application.

## Canonical data path

```text
config/providers.json
  + config/provider-consolidation.json
  -> canonical active provider catalog
  -> deterministic catalog hash
  -> bounded first-party source retrieval
  -> structured adapters / registry-backed current-page adapter SDK
  -> fail-closed internal status draft
  -> source/collection intelligence
  -> 7-day + 30-day reliability and parser canary/quarantine
  -> internal draft validation
  -> Status Contract v3 envelope
  -> public/status.json
  -> browser wire validation
  -> React operator app or wallboard
  -> GitHub Pages
```

The public wire envelope is Status Contract v3. It publishes `schema_version: 3`, `contract_version: 3`, and a deterministic `catalog_hash` for the canonical active provider catalog. Browser validation, release validation, and production smoke all require the same provider identity.

The collector may construct and internally validate a schema-2 draft before the final envelope is emitted. This is an implementation-stage compatibility detail, not the public contract. A narrow compatibility shim accepts a previous deployed schema-3 snapshot only so rolling source history survives the next collection; parser ownership does not return to that shim.

## Source adapters and evidence

Current-page provider-specific conclusions are exposed through `scripts/public-source-repairs.mjs`, which is a registry facade over `scripts/source-adapter-sdk.mjs` and the isolated provider implementation module.

The SDK owns:

- registered adapter identity;
- accepted result kinds;
- stable provider-scoped fallback incident identity;
- current-page provenance defaults for untimed issue conclusions;
- one normalized boundary before current-page conclusions reach payload construction.

Vendor-timed incident evidence remains distinct from current-page snapshot evidence. `observed_at` is an observation time and may be used only under the explicit current-page evidence policy; it is not reclassified as a vendor incident start time.

Cross-layer policies for effective incident time, component disposition, and region scope each have one canonical exported definition. The repository quality gate checks that these policies do not fork into competing implementations.

## Reliability, canaries, and source trust

Every provider publishes two bounded observation windows:

- a seven-day UTC window;
- a nested thirty-day UTC window.

Both reconcile daily live, limited, unavailable, and schema-change counts. SLO states are `warming`, `meeting`, `watch`, and `breach`.

Parser schema canaries publish `stable`, `changed`, or `unobserved` observation state plus a quarantine lifecycle of `clear`, `observing`, or `quarantined`.

Quarantine affects source trust only. An observing or quarantined parser receives a source-quality penalty and cannot remain source-health `healthy`; it becomes `watch` unless the source is already blind. This does not modify vendor `service_state`, `source_state`, accepted incident severity, component state, or a successful transport observation.

Active-event correlation is browser-derived from accepted vendor-timed incidents only. Same-category correlations require at least two providers within twenty minutes; cross-category correlations require at least three. Current-page snapshot observation times are excluded. Every correlation is explicitly non-causal.

## Browser architecture

`src/usePayloadPoller.ts` owns browser payload lifecycle:

- same-origin `status.json` retrieval;
- 5 MiB response-size ceiling;
- request ownership and overlap prevention;
- Status Contract v3 and catalog-hash validation;
- generated-at freshness/future-skew checks;
- successful browser-check telemetry;
- wallboard/operator polling cadence;
- hidden-page deferral;
- overdue refresh on visibility resume.

`src/App.tsx` is a composition layer. It selects the 60-second operator cadence or the URL-controlled wallboard cadence and renders the operator application or wallboard using the poller output.

The static HTML carries a restrictive CSP. Application scripts are local-only and inline script execution is not permitted. Same-origin data retrieval is allowed. Inline styles remain allowed because the React UI uses style attributes.

## Wallboard and browser compatibility

The primary compact signage contract is exactly 458 by 291 pixels. Wallboard URL refresh defaults to three minutes and remains bounded from 15 seconds through one hour. Operator browser polling remains 60 seconds. These are browser retrieval settings and do not change vendor collection cadence.

The production build targets Chrome 98 syntax/CSS compatibility. Non-scheduled code releases run two independent browser gates after deployment:

1. A published Chromium snapshot at or below the Chrome 98 branch-base ceiling exercises the real pre-cascade-layer fallback and must activate the `no-css-layers` path while rendering operational wallboard content.
2. Current hosted Chromium runs the exact 458 by 291 Yodeck geometry, filtering, marquee, overlap, and screenshot verifier.

Untrusted vendor-page collection is a separate trust boundary. Those pages use sandboxed Chromium with disposable profiles and no GitHub credentials. The legacy compatibility browser renders only this repository's already-deployed static application.

## Security and engineering gates

Third-party GitHub Actions references are immutable commit SHAs and use current action generations. The repository has:

- pinned checkout/setup-node/Pages/artifact actions;
- pinned CodeQL v4 for JavaScript/TypeScript on pull requests, `main`, and weekly schedule;
- complete high-severity dependency auditing;
- Dependabot for npm and GitHub Actions;
- dependency-free source-quality and formatting hygiene gates;
- an opt-in executable pre-commit hook running the same quality command.

Checkout credentials are not persisted. Live vendor collection explicitly removes `GITHUB_TOKEN` and `GH_TOKEN` from its process environment. Pages/OIDC/status write permissions are isolated to the deploy job.

## Release architecture

Pages releases use one concurrency group with `cancel-in-progress: false`.

A code-changing push or manual release performs the complete immutable verification path:

1. provider validation;
2. repository quality gates;
3. all deterministic tests;
4. TypeScript;
5. complete dependency audit;
6. token-free live collection;
7. Status Contract v3/hash validation;
8. release reconciliation;
9. application build;
10. publication of a commit-keyed verified application-shell artifact;
11. Pages deployment;
12. production smoke;
13. current-browser operator render;
14. legacy-browser compatibility render;
15. exact current-browser Yodeck verification;
16. artifact/status publication.

Scheduled live-data refreshes reuse the verified application shell for the exact same commit. When that artifact exists they skip unchanged quality, deterministic test, TypeScript, dependency-audit, and application-compilation work. They still perform provider validation, live collection, Status Contract v3/hash validation, release reconciliation, Pages deployment, production smoke, current-browser rendering, exact Yodeck verification, artifact upload, and live-coverage status publication. If the shell artifact is unavailable, the schedule performs a fail-safe build instead of allowing status freshness to lapse.

`status-freshness-watch.yml` remains a separate safety mechanism that dispatches a refresh only when the deployed payload is stale and no release is active.

## Verification status

The complete implementation was merged through PR #111 and the legacy Chromium snapshot-resolution production blocker was repaired through PR #112. Full production release evidence and the required same-commit scheduled shell-reuse evidence are recorded in `docs/architecture-reconciliation.md` once closure is finalized.

The historical `docs/architecture-overhaul.md` documents the earlier reduced-scope pass and is not the authoritative architecture record.