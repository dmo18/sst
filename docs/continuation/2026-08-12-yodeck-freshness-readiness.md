# Yodeck freshness readiness recovery

Date: 2026-08-12
Status: closed, production accepted
Baseline implementation: `e0abe5f04e0578883107edaa13bdfe0f1e3f5007`
Failed production release: #866, run `31609594986`
Recovery PR: #141, `Wait for wallboard freshness before Yodeck acceptance`
Accepted implementation main: `4e5d16533d5c028c054164d748b0af50bcac4a93`
Accepted production release: #867, run `31610194911`

## Failure

Release #866 published the status-truth, Microsoft, and wallboard implementation successfully enough for deployed asset smoke, current Chrome operator rendering, and pinned legacy Chromium to pass. The exact 458x291 Yodeck verification then failed.

Failure:

`Wallboard freshness timestamps are incomplete: updated=missing checked=missing refreshMs=180000`

Immediately before the failure, the app-side layout probe had reported:

`YODECK_LAYOUT_PROBE pass`

`YODECK_LAYOUT_DETAIL viewport:458x291;signals:0;providers:0`

The geometry probe resolved during React's initial loading render. The empty-state node already existed, so `signalCount === 0` looked data-ready even though the audited payload and browser-check timestamp had not arrived.

Release #866 was rejected. The freshness or rotation gates were not weakened.

## Resolution

`scripts/verify-yodeck-wallboard.mjs` no longer accepts `layoutProbe=pass` or `layoutProbe=fail` by itself. The readiness wait samples the wallboard shell and requires all of the following before accepting a resolved layout:

- nonempty `data-wallboard-updated-at`;
- nonempty `data-wallboard-browser-checked-at`;
- a browser refresh interval of at least 15 seconds;
- a resolved layout-probe state.

The verifier emits `YODECK_READINESS` with the accepted timestamps and cadence. If freshness never becomes ready, the timeout reports both the last layout detail and freshness state.

The later contract still rechecks the full header text, freshness attributes, compact geometry, signal window, and provider-rail movement independently.

`scripts/__tests__/yodeck-freshness-readiness.test.js` locks the readiness rule.

## Pull-request proof

PR #141 final head: `d7e4fcf3a769bee63be4920191d9a79d1f22ffdb`.

Pull-request checks:

- run `31610059615`, success;
- CodeQL run `31610059675`, success.

Merge SHA: `4e5d16533d5c028c054164d748b0af50bcac4a93`.

## Accepted production proof

Release #867 run `31610194911` completed successfully through:

- fresh provider collection and payload validation;
- Pages deployment and deployed smoke;
- current Chrome render;
- pinned legacy Chromium runtime;
- exact 458x291 Yodeck verification.

Post-merge CodeQL run `31610195014` succeeded.

Accepted Yodeck output:

`YODECK_VIEWPORT 458x291 dpr=1`

`YODECK_LAYOUT_PROBE pass`

`YODECK_LAYOUT_DETAIL viewport:458x291;signals:4;providers:4`

`YODECK_READINESS updated=2026-08-12T15:03:50.797Z checked=1755011153026 refresh_ms=180000`

`YODECK_PROVIDER_ROTATION providers=4 looping=true moved=true required=true`

`YODECK_FRESHNESS updated=2026-08-12T15:03:50.797Z checked=1755011153026 refresh_ms=180000`

`YODECK_HTML_BYTES 49566`

`YODECK_SCREENSHOT_BYTES 69268`

This proves the verifier waited for loaded freshness state and that the four-provider rail physically moved.

Yodeck artifact:

- id `9146922697`;
- name `yodeck-wallboard-31610194911`;
- digest `sha256:d322475f393acd261baa544bad3e605c309a5599234101754710c043f84f2ffe`.

The compact frame was directly reviewed. It was readable and showed `Payload 2m`, `Browser 0s`, and `Refresh 3m`. The retained DOM contained the full absolute header contract: `Updated 11:03:50 AM`, `Checked 11:05:53 AM`, `Next 11:08:53 AM`, and `Browser refresh 3m`.

The downstream product-experience run `31610444476` also completed successfully after release #867.

## Closure contract

Future exact-signage changes must preserve these rules:

- a layout result is not acceptance until real payload and browser freshness fields exist;
- the 458x291 viewport remains exact and must not overflow or collapse;
- freshness timing remains visible and machine-verifiable;
- when more than one provider is active, the provider rail must report and demonstrate real movement;
- a failing readiness or movement assertion retains evidence and is fixed at the cause rather than weakened.
