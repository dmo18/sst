# Operations intelligence contracts

Status: Phase 4 implementation
Date: 2026-08-10

This document defines the reliability, parser-canary, and event-correlation features added during the architecture overhaul. These features are operational evidence controls. They do not replace or modify vendor service-health conclusions.

## Seven-day source observation SLO

Each provider carries a bounded `source_reliability` record. The record contains at most seven UTC calendar-day buckets and is rolled forward from the previous validated production payload.

Each collection run contributes exactly one provider observation:

- `live`: the current official source was successfully observed with `source_state=available` and `ok=true`;
- `limited`: the provider is represented from a limited or stale official observation;
- `unavailable`: no current accepted observation was available for that provider during the run.

The rollup publishes:

- `window_days`, fixed at 7;
- `sample_count`;
- `live_percent`;
- `limited_percent`;
- `unavailable_percent`;
- `schema_change_count`;
- `slo_state`;
- the bounded daily buckets used to reconcile those totals.

SLO states are deliberately conservative:

- `warming`: fewer than 10 observations exist in the rolling window;
- `meeting`: at least 99 percent live observations and zero unavailable observations;
- `watch`: at least 95 percent live observations but not meeting the stronger target;
- `breach`: below 95 percent live observations.

This is an observation-availability SLO. A source SLO breach is not a vendor outage and cannot change `service_state`.

## Parser schema canary

Each provider carries a `schema_canary` record with:

- `state`: `stable`, `changed`, or `unobserved`;
- `observation`: `accepted` or `unavailable`;
- the current schema fingerprint when one is available;
- `last_changed_at` for the most recent detected shape change.

A shape change can raise operator attention and create an audit event, but the canary is intentionally separate from service-health inference. Service state remains derived from accepted first-party service evidence under the existing fail-closed rules.

The server and browser both consume the same `src/sourceReliabilityContract.ts` metadata validator. Reconciliation errors, invalid percentages, malformed daily buckets, and malformed canary metadata reject the payload.

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

Every cluster explicitly states: temporal correlation only; no causal relationship is inferred.

Correlation does not use customer, tenant, ticket, device, user, or other private MSP data. The public static architecture remains free of client-specific information.

## Operator surface

The operator console mounts an Operations Intelligence panel outside wallboard mode. It exposes:

- source SLO distribution;
- watch and breach providers;
- parser canary changes;
- active vendor-timed correlation clusters;
- explicit evidence-boundary language.

The wallboard composition is unchanged. The exact 458 by 291 Yodeck contract remains controlled by `WallboardV2` and its existing production verifier.

## Validation and release requirements

The feature is not considered released until all of the following succeed on the merged production commit:

1. canonical provider validation;
2. deterministic tests;
3. TypeScript checking;
4. complete dependency audit;
5. token-free sandboxed live vendor collection;
6. server validation of `source_reliability` and `schema_canary`;
7. browser validation of the same shared metadata contract;
8. release-contract reconciliation;
9. application build and Pages deployment;
10. deployed smoke test;
11. normal browser rendering;
12. exact 458 by 291 Yodeck verification;
13. deployed-intelligence status publication.
