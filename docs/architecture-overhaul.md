# Architecture overhaul plan

Status: in progress
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
- [ ] Strengthen fallback incident identity. This is intentionally sequenced with the Phase 2 producer-boundary migration so one PR does not combine broad collector identity changes with browser contract changes.

## Phase 2: architecture cleanup

- [x] Move status enum values and cross-layer temporal policy into a shared runtime contract. The foundation landed in Phase 1 so browser validation could use it immediately.
- [ ] Emit current-page provenance at the source adapter boundary and remove the RingCentral post-processing dependency.
- [ ] Strengthen fallback incident identity using a stable semantic signature when a vendor incident id is unavailable.
- [ ] Consolidate duplicated status validation and reconciliation behind reusable helpers and commands.
- [ ] Reduce legacy collector responsibilities in `scripts/update-status.mjs` to infrastructure still used by the production collector.
- [ ] Clarify collection timing semantics so aggregate collection elapsed time is not presented as a single request latency.

## Phase 3: pipeline and security hardening

- [ ] Pin GitHub Actions dependencies to immutable revisions where practical.
- [ ] Strengthen dependency and source checks without adding third-party browser runtime dependencies.
- [ ] Isolate rendered vendor-page collection from deployment credentials and document that trust boundary.
- [ ] Extend regression coverage for provenance, catalog identity, contract parity, compatibility, and production smoke semantics.

## Phase 4: next-level operations intelligence

- [ ] Add bounded source reliability history suitable for source SLO reporting.
- [ ] Add parser/schema canary semantics that distinguish source-shape changes from trusted service evidence.
- [ ] Add cautious active-event correlation that reports correlation, never causality.
- [ ] Surface source reliability and event correlation in the operator experience without introducing customer, tenant, or ticket data into the public application.

## Delivery process

Each phase is implemented on a focused `agent/` branch and pull request. Pull-request validation must pass before merge. After merge, the production Pages workflow must pass live collection, server and browser validation, build, deployment identity, smoke checks, normal headless rendering, and exact Yodeck verification before the next phase proceeds.

Critical implementation decisions and any production-discovered contract mismatch are recorded in this file before the phase is closed.

## Phase record

### Phase 1

Branch: `agent/status-contract-overhaul-phase-1`

Initial findings being corrected:

1. Untimed current-page incidents can be accepted by server validation but disappear from an `alerts=` wallboard because the UI ignores `observed_at` when deriving event time.
2. The operator console maintains a second browser-check clock and can report a check before a validated request succeeds.
3. Component problem classification differs between collection metrics, browser validation, the view model, and the provider drawer.
4. Browser payload reconciliation is self-consistent but does not prove parity with the active canonical provider catalog.
5. Provider overrides are applied after raw validation and are not fully revalidated as canonical provider records.

Implemented decisions:

- `src/statusContract.ts` is the shared browser/runtime vocabulary and temporal policy. Current-page evidence is not reclassified as a vendor timestamp. It receives an effective display/filter time only when `evidence_basis` is `current-page` and `observed_at` is valid and fresh.
- Current-page and vendor-timed incident evidence both use the existing 72-hour current-evidence horizon and five-minute future-skew tolerance.
- `src/componentStatus.ts` now classifies component states as healthy, problem, or neutral. Unknown and maintenance states are neutral, not green and not degraded.
- `src/providerCatalog.ts` is the canonical active browser catalog after exclusions and overrides. Browser validation and production smoke now reject missing or unexpected provider ids.
- Browser status retrieval is limited to 5 MiB before JSON parsing and performs an immediate visibility-resume check when the last validated browser retrieval is due.
- `App.tsx` owns the successful browser-check timestamp. The operator console consumes that timestamp instead of synthesizing its own clock on manual refresh.
- Canonical provider overrides receive a second validation pass after consolidation.

Safe sequencing decision:

Fallback incident identity and removal of the RingCentral normalizer remain in Phase 2. They touch the collector's incident-construction boundary, so they will be changed only after Phase 1 proves the new browser/runtime contract in production. This keeps each release independently reversible.
