# Yodeck freshness readiness recovery

Date: 2026-08-12
Status: in progress
Baseline implementation: `e0abe5f04e0578883107edaa13bdfe0f1e3f5007`
Failed production release: #866, run `31609594986`
Branch: `fix/yodeck-freshness-readiness-2026-08-12`

## Failure

Release #866 published the new status-truth, Microsoft, and wallboard implementation successfully enough for deployed asset smoke, the current Chrome operator render, and pinned legacy Chromium to pass. The exact 458x291 Yodeck verification then failed.

The failure was:

`Wallboard freshness timestamps are incomplete: updated=missing checked=missing refreshMs=180000`

Immediately before the failure, the wallboard's app-side layout probe had already reported:

`YODECK_LAYOUT_PROBE pass`

`YODECK_LAYOUT_DETAIL viewport:458x291;signals:0;providers:0`

This proved the geometry probe could resolve during React's initial loading render. The empty-state node already existed, so `signalCount === 0` looked data-ready even though the audited payload and browser-check timestamp had not arrived.

## Resolution

`scripts/verify-yodeck-wallboard.mjs` no longer accepts `layoutProbe=pass` or `layoutProbe=fail` by itself. The readiness wait samples the wallboard shell and requires all of the following before accepting a resolved layout:

- nonempty `data-wallboard-updated-at`;
- nonempty `data-wallboard-browser-checked-at`;
- a valid browser refresh interval of at least 15 seconds;
- a resolved layout-probe state.

The verifier emits `YODECK_READINESS` with the accepted timestamps and cadence. If freshness never becomes ready, the timeout includes both the last layout detail and freshness state.

The later contract still rechecks the header text and freshness attributes independently, so this change does not weaken the update/refresh requirement. It prevents an initial empty render from being mistaken for a verified loaded wallboard.

A deterministic source regression test in `scripts/__tests__/yodeck-freshness-readiness.test.js` locks this readiness rule.

## Completion requirement

Do not close this follow-up until a new main release passes the full Pages deployment, current Chrome, pinned legacy Chromium, exact 458x291 Yodeck verification, and the downstream product-experience workflow. The successful Yodeck log must include `YODECK_READINESS`, `YODECK_FRESHNESS`, and `YODECK_PROVIDER_ROTATION`.

If more than one alert provider is active in the accepted production frame, `YODECK_PROVIDER_ROTATION` must report `required=true` and `moved=true`.
