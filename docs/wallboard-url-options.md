# Wallboard URL and Yodeck options

Wallboard mode is configured through URL query parameters so a non-interactive display can be configured once and left running.

The deployed online help is available at:

```text
https://dmo18.github.io/sst/help.html
```

## Base URL

```text
https://dmo18.github.io/sst/?view=wallboard
```

`view=wallboard` selects the active `WallboardV2` interface.

## Provider selection

Use `providers=ID,ID` to restrict the wallboard to specific enabled catalog providers. The selection controls Priority signals, the active-provider rail, and Provider Watch; it does not change collection or operator-console coverage.

```text
?view=wallboard&providers=kaseya,eset
?view=wallboard&providers=microsoft365,entra,aws&alerts=24h
```

Use canonical provider IDs, separated by commas. IDs are case-insensitive, duplicates are ignored, and disabled or unknown IDs are excluded. Omitting `providers` preserves the default of showing every enabled provider. A supplied list containing no enabled IDs intentionally shows no provider-specific wallboard content.

## Alert window

Use `alerts=NUMBERm`, `alerts=NUMBERh`, or `alerts=NUMBERd` to show only vendor incidents whose latest vendor update falls within that rolling window.

Examples:

```text
?view=wallboard&alerts=90m
?view=wallboard&alerts=24h
?view=wallboard&alerts=36h
?view=wallboard&alerts=2d
```

Rules:

- Minimum: one minute.
- Maximum: 30 days.
- Decimal values are accepted when the resulting duration remains in range.
- Missing or invalid values show all active vendor incidents in the payload.
- An incident exactly on the cutoff remains visible.
- The cutoff is recalculated against the browser clock.
- The same filtered incident set drives the vertical incident marquee and the horizontal provider rail.

The filter uses the action item's latest update timestamp. It does not use the incident's first detection time.

## Browser refresh interval

Use `refresh=NUMBERs`, `refresh=NUMBERm`, or `refresh=NUMBERh` to control how often wallboard mode fetches and validates the deployed `status.json` payload while the page is visible.

Examples:

```text
?view=wallboard&alerts=24h&refresh=30s
?view=wallboard&alerts=24h&refresh=1m
?view=wallboard&alerts=24h&refresh=3m
?view=wallboard&alerts=24h&refresh=5m
?view=wallboard&alerts=24h&refresh=1h
```

Rules:

- Minimum: 15 seconds.
- Maximum: one hour.
- Decimal values are accepted when the resulting duration remains in range.
- Missing or invalid values fall back to three minutes.
- The interval only applies while wallboard mode is active.
- Hidden browser tabs do not perform the scheduled payload check until the page is visible again.
- Changing the URL option changes the in-app browser payload polling cadence, not GitHub Actions collection cadence.
- Yodeck's own full-page Refresh Interval is separate and is not required for this option.

The office tile labels its payload polling countdown “Screen data refresh”. This follows the actual interval timer, including after failed checks; refreshing retains cached data, and failures remain visibly stale. Larger wallboards retain browser-check age telemetry. Provider valid/invalid counts cover all monitored providers, even when the incident feed is filtered.

## Primary Yodeck viewport

The primary compact deployment target is:

```text
Width: 458px
Height: 291px
```

At that size (up to 520px wide and 360px high), the wallboard now uses the **office glance board**:

- A continuous vertical incident feed replaces page switching. Rows grow from 60px to fit their details, up to about 86px; overflow loops seamlessly at 18px/second.
- Each row shows provider name/logo, attention label, latest vendor-update age, a headline and up to four lines of vendor detail.
- Descriptions use bounded verbatim vendor excerpts (up to 360 characters), never invented summaries.
- Critical attention sorts first, then action, then watch; each tier sorts newest update first.
- A static single 20px footer keeps three plain labels visible: data age, time until the next screen-data refresh, and global valid/invalid provider-status counts. No rotating messages, confusing collection estimates, or “LIVE” badge. Stale/error labels stay explicit. Exact successful update time in ET remains in the data-age tooltip. Valid means usable status evidence, not necessarily an operational service.
- The total issue count, critical count, affected-provider count and 26px affected-provider icons remain visible above the moving feed (up to eight icons plus an overflow count).
- Empty, loading, stale, and error states do not claim all services are operational.
- No header/KPI overlay can cover this compact view. The normal desktop wallboard and its full descriptions remain unchanged.
- Motion runs only on overflow, with two adjacent identical copies. A Web Animations timeline runs continuously at 18px/s under both normal and reduced-motion settings; global UI animation overrides cannot stop it. Pixel offset is preserved when list height changes. The animation and resize observation are cleaned up on unmount. Left provider icons are 30px.
- `src/CompactIncidentBoard.tsx` and the final unlayered `src/styles/wallboard-glance.css` own this compact presentation, including Chromium 92 compatibility.

The incident inclusion, provider selection, time window, and collection logic are unchanged. Complete vendor titles/details remain in the normal operator/desktop view and row tooltips.

## Header and KPI overlay

The full wallboard header and KPI strip are one overlay unit. User activity reveals the overlay in automatic mode. The overlay supports three persisted modes:

- Auto hide: show after activity, then hide after about 3.2 seconds.
- Pin open: keep the header and KPI strip visible.
- Minimize: keep the overlay closed and reveal only a small Show header control after activity.

The selected mode is stored in local storage under `sst-wallboard-header-mode`.

The office glance board suppresses this overlay entirely. These controls continue to apply to larger wallboards.

## Priority-signal rules

Priority signals include active vendor incidents only. They exclude:

- Routine scheduled or in-progress maintenance.
- Collector failures.
- Unreadable-source fallback records.
- Parser and schema warnings.
- Resolved incidents.
- Informational notices without current customer impact.

Rows are sorted by latest vendor update, newest first. Provider names and icons are preserved in both the provider rail and incident rows.

## Continuous loops

Larger wallboards retain separate React-owned loop tracks (the office glance board uses its own compact vertical feed):

- Horizontal provider speed: approximately 28 pixels per second.
- Vertical incident speed: approximately 22 pixels per second.
- Each loop activates only when its content exceeds the available viewport.
- Each loop renders a second copy so the reset occurs at the duplicate boundary.
- The provider rail continues looping on unattended displays.
- The incident list continues looping on unattended displays, including reduced-motion signage environments, so the compact wallboard does not strand lower rows off-screen.

## Browser compatibility

The normal wallboard presentation uses CSS Cascade Layers. Modern Chromium uses `src/styles/wallboard-v2.css` directly and keeps the approved compact presentation unchanged.

A physical Yodeck player exposed a compatibility case where an older Chromium build could load the page and data but fail to apply layered wallboard structure. Two symptoms were observed:

1. In a smaller Yodeck region the page could appear blank.
2. When made full-screen the data could appear as vertically stacked KPI blocks instead of the compact Priority signals view.

The repository now includes a capability-gated fallback for that case.

Before React mounts, `src/main.tsx` checks whether `CSSLayerBlockRule` exists. If it does not, the root HTML element receives the `no-css-layers` class. `src/styles/wallboard-compat.css` is loaded after the normal wallboard stylesheet and contains unlayered structural rules scoped only to `html.no-css-layers`.

The fallback restores:

- fixed full-viewport wallboard geometry;
- compact 458 by 291 layout behavior;
- Priority signals structure and telemetry;
- provider-chip rail;
- incident row grid;
- provider and incident marquees;
- header and KPI overlay visibility;
- compact breakpoint behavior.

The fallback does not create a second wallboard implementation. React still owns the data, filtering, state, ordering, controls, and rendering tree. Modern browsers do not match the compatibility selectors.

PR 74, `Fix Yodeck wallboard rendering on pre-layer Chromium`, merged at commit `33f7d873a3a22000030beec23091027b4fc9cee8`. Production release run 614 completed successfully after the merge.

## Yodeck troubleshooting

Use the wallboard URL directly and first determine whether the player is failing to load data or only failing to present the intended layout.

A page that shows current KPI values or incident text is loading application data. If those values appear as large vertical blocks rather than the compact Priority signals wallboard, treat the problem as browser presentation compatibility rather than a status-data failure.

A completely blank small region combined with a visible but collapsed full-screen page is also consistent with the legacy CSS compatibility case addressed by PR 74.

After a new production deployment, force the Yodeck player or playlist to reload so it receives the latest built JavaScript and CSS assets.

Do not add Yodeck-side scripts, DOM manipulation, alternate status endpoints, or browser-side vendor collection to work around a presentation problem. The repository compatibility path is intentionally self-contained.

## Recommended Yodeck URLs

For a 24-hour operational window with the default three-minute browser check made explicit:

```text
https://dmo18.github.io/sst/?view=wallboard&alerts=24h&refresh=3m
```

For a 36-hour operational window with a 30-second browser check:

```text
https://dmo18.github.io/sst/?view=wallboard&alerts=36h&refresh=30s
```

The automated production contract uses the 36-hour alert-window form together with `layoutProbe=yodeck` for exact 458 by 291 verification. The `layoutProbe` parameter is for automated verification and is not required for normal signage use.

## Compact motion verification

Run `scripts/verify-yodeck-wallboard.mjs` with `MOTION_AUDIT_DIR=/path/to/artifacts` to capture a full feed loop, PNG frames and `motion.json`. It samples rendered animation frames and checks for blank frames, discontinuities and an actual wrap back to the first item. Use `REDUCED_MOTION=1` to repeat under the system accessibility preference. Inspect the captures, not just the audit result. The normal verifier checks the fixed one-line footer, 26px heading icons, 30px row icons and four-line details.
