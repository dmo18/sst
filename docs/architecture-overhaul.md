# Architecture overhaul plan

Status: in progress, final production verification pending
Started: 2026-08-10
Tracking: repository Issues are disabled, so this document is the authoritative implementation tracker.

## Objective

Complete the post-review architecture overhaul while preserving the production trust and delivery contracts:

- first-party public sources only;
- fail-closed service conclusions;
- source health remains distinct from service health;
- wallboard browser polling defaults to 180 seconds;
- operator browser polling remains 60 seconds;
- `refresh=` remains bounded from 15 seconds through one hour for wallboard browser retrieval only;
- GitHub Actions vendor collection cadence is unchanged unless a later phase explicitly documents and validates a scheduling change;
- Yodeck full-page refresh behavior is unchanged;
- Pages releases remain serialized;
- every production release continues to prove deployment identity, browser payload compatibility, normal browser rendering, and the exact 458 by 291 Yodeck contract.

## Phase 1: correctness and contract convergence

- [x] Preserve current-page incident provenance through browser validation and wallboard alert-window filtering.
- [x] Define one canonical effective incident timestamp including `observed_at` for current-page evidence.
- [x] Make operator browser-check telemetry authoritative and owned by the payload polling layer.
- [x] Add visibility-resume refresh and a bounded browser payload size.
- [x] Centralize component-status classification so collector, browser validator, view model, and provider drawer agree.
- [x] Validate the canonical post-consolidation provider catalog, not only raw entries.
- [x] Enforce browser payload provider parity with the canonical active catalog.
- [x] Harden local-storage access for restricted browsers.
- [x] Strengthen fallback incident identity. The implementation was sequenced into Phase 2 with the producer-boundary migration.

## Phase 2: architecture cleanup

- [x] Move status enum values and cross-layer temporal policy into a shared runtime contract. The foundation landed in Phase 1 so browser validation could use it immediately.
- [x] Emit current-page provenance at the source adapter boundary and remove the RingCentral post-processing dependency.
- [x] Strengthen fallback incident identity using a stable semantic signature when a vendor incident id is unavailable.
- [x] Consolidate the deployment release invariants behind reusable code consumed by workflow verification and production smoke.
- [x] Reduce legacy collector responsibilities so the production collector depends on a small status core instead of the legacy parser monolith.
- [x] Clarify collection timing semantics so aggregate collection elapsed time is not presented as a single request latency.

## Phase 3: pipeline and security hardening

- [x] Pin GitHub Actions dependencies to immutable revisions where practical.
- [x] Strengthen dependency and source checks without adding third-party browser runtime dependencies.
- [x] Isolate rendered vendor-page collection from deployment credentials and document that trust boundary.
- [x] Extend regression coverage for provenance, catalog identity, contract parity, compatibility, production smoke, and pipeline supply-chain semantics.

## Phase 4: next-level operations intelligence

- [x] Add bounded source reliability history suitable for source SLO reporting.
- [x] Add parser/schema canary semantics that distinguish source-shape changes from trusted service evidence.
- [x] Add cautious active-event correlation that reports correlation, never causality.
- [x] Surface source reliability and event correlation in the operator experience without introducing customer, tenant, or ticket data into the public application.

## Delivery process

Each phase is implemented on a focused `agent/` branch and pull request. Pull-request validation must pass before merge. After merge, the production Pages workflow must pass live collection, server and browser validation, build, deployment identity, smoke checks, normal headless rendering, and exact Yodeck verification before the next phase proceeds.

Critical implementation decisions and any production-discovered contract mismatch are recorded in this file before the phase is closed.

## Phase record

### Phase 1

Branch: `agent/status-contract-overhaul-phase-1`
Pull request: #98
Merge commit: `ab94fe5acc1039ec4830b0f43dd520614232026a`
Production release: run #780, successful

Initial findings corrected:

1. Untimed current-page incidents could be accepted by server validation but disappear from an `alerts=` wallboard because the UI ignored `observed_at` when deriving event time.
2. The operator console maintained a second browser-check clock and could report a check before a validated request succeeded.
3. Component problem classification differed between collection metrics, browser validation, the view model, and the provider drawer.
4. Browser payload reconciliation was self-consistent but did not prove parity with the active canonical provider catalog.
5. Provider overrides were applied after raw validation and were not fully revalidated as canonical provider records.

Implemented decisions:

- `src/statusContract.ts` is the shared browser/runtime vocabulary and temporal policy. Current-page evidence is not reclassified as a vendor timestamp. It receives an effective display/filter time only when `evidence_basis` is `current-page` and `observed_at` is valid and fresh.
- Current-page and vendor-timed incident evidence both use the existing 72-hour current-evidence horizon and five-minute future-skew tolerance.
- `src/componentStatus.ts` classifies component states as healthy, problem, or neutral. Unknown and maintenance states are neutral, not green and not degraded.
- `src/providerCatalog.ts` is the canonical active browser catalog after exclusions and overrides. Browser validation and production smoke reject missing or unexpected provider ids.
- Browser status retrieval is limited to 5 MiB before JSON parsing and performs an immediate visibility-resume check when the last validated browser retrieval is due.
- `App.tsx` owns the successful browser-check timestamp. The operator console consumes that timestamp instead of synthesizing its own clock on manual refresh.
- Canonical provider overrides receive a second validation pass after consolidation.

Production evidence:

Run #780 passed 247 deterministic tests, TypeScript, production dependency audit, live collection for 79 of 79 providers, 100 percent live coverage, browser contract validation, deployment identity, normal browser rendering, and the exact 458 by 291 Yodeck verification.

### Phase 2

Branch: `agent/status-contract-overhaul-phase-2`
Pull request: #99
Merge commit: `b3bd4cf8d0c368a9113a54b6a043a5f6398d8044`
Production release: run #782, successful

Implemented decisions:

- Rendered current-page issue conclusions emit `evidenceBasis: current-page` at the source conclusion boundary. `makeIncident` converts that field into `evidence_basis` and records `observed_at`, so the RingCentral-specific file normalizer and package stage are removed.
- Producer provenance regression tests cover RingCentral and Salesforce current-page conclusions.
- Fallback rendered-page incidents receive stable semantic IDs derived from provider, title, source, affected service, first detection, and bounded detail. Multi-record adapters prefer vendor IDs when available. No new payload post-processing stage was introduced.
- The former inline workflow release-contract implementation is now `scripts/release-contract.mjs` plus `scripts/verify-release-contract.mjs`. Production smoke consumes the same invariant code.
- Provider collection timing is split into `last_request_ms` and `collection_elapsed_ms`. `source_latency_ms` remains temporarily as a compatibility alias for the last request rather than the sum of all retrieval work. Browser validation explicitly validates both new fields.
- The duplicated 8x8 provider-specific branch was removed while touching the source conclusion module.
- The generic production helpers formerly embedded in the large legacy collector were extracted into `scripts/status-core.mjs`. `scripts/update-status.mjs` is now only a compatibility re-export of that small core. The previous monolith is preserved as `scripts/legacy-update-status.mjs`, and a regression test prevents production from regaining legacy parser ownership.

CI note:

An early Phase 2 deterministic run failed after removing the normalizer. The response was treated as a contract migration failure, not as a reason to relax validation. The final shared source-conclusion boundary normalizes untimed current-page issues with stable identity and explicit provenance, while timed vendor records remain unchanged.

Production evidence:

Run #782 passed all 253 deterministic tests, canonical provider validation, TypeScript, dependency audit, live collection for 79 of 79 providers, 100 percent live coverage, zero fallbacks, browser payload compatibility, the extracted release contract, deployment identity, normal headless rendering, exact 458 by 291 Yodeck verification, artifact upload, and final status publication. The live payload contained 7 incidents and 48 maintenance events with collection quality 86 and zero blind spots. This is the first production release with the RingCentral postprocessor removed.

### Phase 3

Branch: `agent/status-contract-overhaul-phase-3`
Pull request: #100
Merge commit: `4123914b405d84478a30deb68e4c24f1eb39d3cf`
Production release: run #784, successful

Implemented decisions:

- Every third-party action reference in repository workflows is pinned to a full immutable commit SHA. Human-readable major versions remain comments only.
- Checkout credentials are never persisted into a repository worktree.
- The live vendor collection step explicitly removes `GITHUB_TOKEN` and `GH_TOKEN` from its process environment. Its job has read-only repository permission and no Pages, status, action-write, or identity-token permission.
- Remote vendor pages rendered by Chromium now use the browser sandbox instead of `--no-sandbox`, use a disposable per-render profile, and delete that profile after the observation.
- PR and production gates audit the complete dependency graph, including build tooling, at high severity.
- Dependabot owns weekly npm and GitHub Actions update proposals.
- `pipeline-security.test.js` makes immutable action refs, non-persisted checkout credentials, token-free collection, sandboxed vendor rendering, full dependency audit, Dependabot ownership, and locally bundled browser assets deterministic repository contracts.

Production evidence:

Run #784 passed the full hardened release path. Token-free sandboxed vendor collection produced 79 of 79 validated providers with 100 percent live coverage, followed by server validation, browser payload compatibility, the reusable release contract, full dependency audit, deployment identity, normal headless rendering, exact 458 by 291 Yodeck verification, verification artifact upload, and final deployed-intelligence status publication.

### Phase 4

Branch: `agent/status-contract-overhaul-phase-4`
Pull request: #109
Production release: pending merge and live verification

Implemented decisions:

- Every provider now carries `source_reliability`, a bounded seven-day UTC daily rollup of live, limited, and unavailable source observations. The record includes reconciled percentages, schema-change count, and an observation SLO state.
- SLO states are `warming`, `meeting`, `watch`, and `breach`. Fewer than ten observations remain warming. Meeting requires at least 99 percent live observations and zero unavailable observations; watch requires at least 95 percent live observations; lower availability is a breach.
- Source SLO state measures collector observation reliability only. It never changes vendor `service_state`.
- Every provider also carries `schema_canary`, which records current fingerprint observation state and the latest detected source-shape change. A canary change can raise operator attention but cannot create an outage conclusion.
- `src/sourceReliabilityContract.ts` is consumed by both server and browser validation, so rolling SLO metadata and parser-canary metadata use one reconciliation contract.
- Active correlation uses only vendor-timed incidents. Snapshot-only `current-page` observations are excluded because `observed_at` is an observation time, not an incident-start time.
- Same-category correlation requires at least two distinct providers inside twenty minutes. Cross-category correlation requires at least three distinct providers inside the same window. Every cluster explicitly states that temporal correlation is not causation.
- The operator-only Operations Intelligence panel exposes source SLO distribution, watch and breach sources, parser canaries, and active correlation clusters. Wallboard composition remains unchanged.
- No customer, tenant, ticket, device, user, or other private MSP data was added to the public application.
- `docs/operations-intelligence.md` defines the source SLO, parser-canary, correlation, UI, and release contracts in detail.

Pull-request evidence:

PR #109 passed canonical provider validation, the deterministic test suite including new reliability/correlation/safety contracts, TypeScript checking, the production application build, and the complete dependency audit on its implementation head. The phase remains open until the merged production release proves live rolling metadata, browser/server parity, deployed rendering, and exact Yodeck verification.
