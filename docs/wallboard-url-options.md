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
?view=wallboard&alerts=24h&refresh=5m
?view=wallboard&alerts=24h&refresh=1h
```

Rules:

- Minimum: 15 seconds.
- Maximum: one hour.
- Decimal values are accepted when the resulting duration remains in range.
- Missing or invalid values fall back to one minute.
- The interval only applies while wallboard mode is active.
- Hidden browser tabs do not perform the scheduled payload check until the page is visible again.
- Changing the URL option changes the in-app browser payload polling cadence, not GitHub Actions collection cadence.
- Yodeck's own full-page Refresh Interval is separate and is not required for this option.

The compact telemetry label `Browser` is the age since the most recent successful browser payload check. It is not the configured interval itself. For example, with `refresh=1m`, `Browser 25s` means the current browser successfully checked the payload 25 seconds ago and will make the next scheduled check on its one-minute cadence.

## Primary Yodeck viewport

The primary compact deployment target is:

```text
Width: 458px
Height: 291px
```

At that size the wallboard enters compact mode:

- Provider Watch is hidden.
- The footer is hidden.
- Priority signals fills the tile.
- The visible Priority signals text label is replaced by the active-provider rail.
- Provider icons and provider names share that top rail.
- Payload age and browser-check age remain fixed at the right side of the top rail.
- The provider rail loops horizontally when its content exceeds the available width.
- The incident list loops vertically when its content exceeds the available height.
- Incident rows retain provider icon, provider name, update age, title, and complete vendor detail text.
- Compact TV spacing is tuned separately in `src/styles/wallboard-tv.css` while React keeps ownership of the incident data and marquee state.
- The page requires no pointer, keyboard, or touch interaction during normal operation.

## Header and KPI overlay

The full wallboard header and KPI strip are one overlay unit. User activity reveals the overlay in automatic mode. The overlay supports three persisted modes:

- Auto hide: show after activity, then hide after about 3.2 seconds.
- Pin open: keep the header and KPI strip visible.
- Minimize: keep the overlay closed and reveal only a small Show header control after activity.

The selected mode is stored in local storage under `sst-wallboard-header-mode`.

For unattended Yodeck use, minimize the overlay after configuration so it cannot cover the compact incident view.

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

The provider rail and incident list use separate React-owned loop tracks:

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

For a 24-hour operational window with the default one-minute browser check made explicit:

```text
https://dmo18.github.io/sst/?view=wallboard&alerts=24h&refresh=1m
```

For a 36-hour operational window with a 30-second browser check:

```text
https://dmo18.github.io/sst/?view=wallboard&alerts=36h&refresh=30s
```

The automated production contract uses the 36-hour alert-window form together with `layoutProbe=yodeck` for exact 458 by 291 verification. The `layoutProbe` parameter is for automated verification and is not required for normal signage use.
