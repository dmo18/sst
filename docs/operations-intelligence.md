# Operations intelligence contracts

Status: full architecture reconciliation implementation
Date: 2026-08-10

This document defines the source-reliability, parser-canary/quarantine, and event-correlation contracts used by the public ServiceOps application. These features are source-trust and operational-evidence controls. They do not replace vendor service-health evidence.

## Seven-day and thirty-day source observation SLOs

Each provider carries a bounded `source_reliability` record. The top-level window is seven UTC calendar days and contains a nested `window_30d` record for thirty UTC calendar days. Both windows are rolled from the previous validated production payload and independently reconcile their daily buckets.

Each collection run contributes exactly one provider observation:

- `live`: the current official source was successfully observed with `source_state=available` and `ok=true`;
- `limited`: the provider is represented from a limited or stale official observation;
- `unavailable`: no current accepted observation was available for that provider during the run.

Each window publishes:

- `window_days`, fixed at 7 or 30;
- `sample_count`;
- `live_percent`;
- `limited_percent`;
- `unavailable_percent`;
- `schema_change_count`;
- `slo_state`;
- bounded UTC daily buckets used to reconcile those totals.

SLO states are deliberately conservative:

- `warming`: fewer than 10 observations exist in the window;
- `meeting`: at least 99 percent live observations and zero unavailable observations;
- `watch`: at least 95 percent live observations but not meeting the stronger target;
- `breach`: below 95 percent live observations.

These are observation-availability SLOs. A source SLO breach is not a vendor outage and cannot change `service_state`.

## Parser schema canary and quarantine

Each provider carries a `schema_canary` record with:

- `state`: `stable`, `changed`, or `unobserved`;
- `observation`: `accepted` or `unavailable`;
- the current schema fingerprint when one is available;
- `last_changed_at` for the most recent detected shape change;
- `quarantine_state`: `clear`, `observing`, or `quarantined`;
- `quarantine_since` while observation or quarantine is active;
- `stable_observations`, the bounded recovery counter.

The state machine is intentionally cautious:

1. A first accepted fingerprint change enters `observing`.
2. A second different accepted fingerprint while observation/quarantine is active enters `quarantined`.
3. One stable accepted observation clears `observing`.
4. Two stable accepted observations clear `quarantined`.
5. An unavailable observation never fabricates a new fingerprint and does not silently clear an active quarantine.

Quarantine affects source trust, not vendor service truth. During `observing` or `quarantined`, source quality is penalized and `source_health` cannot be `healthy`; an otherwise accepted source becomes `watch`. This does not change `service_state`, `source_state`, `ok`, incident severity, or component conclusions. A parser quarantine therefore cannot create, suppress, or resolve a vendor outage.

`src/sourceReliabilityContract.ts` is consumed by both server and browser validation. Reconciliation errors, invalid percentages, malformed daily buckets, malformed canary state, and malformed quarantine metadata reject the public payload.

## Status Contract v3 relationship

Public operations-intelligence metadata ships only inside Status Contract v3. The public envelope contains:

- `schema_version: 3`;
- `contract_version: 3`;
- the canonical active-provider `catalog_hash`;
- provider reliability and canary/quarantine metadata validated by the shared contract.

Browser validation and release validation require the same canonical catalog hash, preventing a self-consistent but stale/mismatched provider set from being accepted.

## Active event correlation

Correlation is derived in the browser from active incidents already accepted by the payload contract. It does not create incidents or change their severity.

Timing rules:

- only vendor-timed incidents participate;
- `first_detected` is preferred, followed by `rawTime`, then `latest_update`;
- `current-page` snapshot observations are excluded because `observed_at` records observation time, not incident start time;
- the correlation window is 20 minutes.

Qualification rules:

- two or more distinct providers in the same service category inside the window produce a medium-confidence category cluster;
- otherwise, three or more distinct providers across at least two categories inside the window produce a low-confidence cross-service cluster;
- two cross-category incidents are insufficient;
- duplicate providers do not increase cluster size.

Every cluster explicitly states that temporal correlation is not causation.

Correlation does not use customer, tenant, ticket, device, user, or other private MSP data. The public static architecture remains free of client-specific information.

## Operator surface

The operator console mounts an Operations Intelligence panel outside wallboard mode. It exposes:

- seven-day source SLO distribution;
- seven-day and thirty-day reliability for watch/breach providers;
- parser shape changes and active quarantine state;
- active vendor-timed correlation clusters;
- explicit evidence-boundary language.

The wallboard composition is unchanged. The exact 458 by 291 Yodeck contract remains controlled by `WallboardV2` and its production verifier.

## Validation and release requirements

The operations-intelligence contract is not considered production-verified until all of the following succeed on the merged implementation commit:

1. canonical provider validation and catalog-hash derivation;
2. repository quality gates;
3. deterministic tests;
4. TypeScript checking;
5. complete dependency audit and CodeQL analysis;
6. token-free sandboxed live vendor collection;
7. Status Contract v3 emission;
8. shared server/browser validation of seven-day and thirty-day reliability plus canary/quarantine metadata;
9. release-contract reconciliation against the canonical catalog hash;
10. application build and Pages deployment;
11. deployed smoke test including CSP and Status Contract v3 identity;
12. normal current-browser rendering;
13. pinned pre-cascade-layer Chromium compatibility rendering on non-scheduled code releases;
14. exact 458 by 291 current-Chromium Yodeck verification;
15. deployed-intelligence status publication;
16. a subsequent scheduled data refresh that reuses the verified application-shell artifact for the same commit while still passing live collection, validation, deployment, smoke, rendering, and Yodeck verification.
