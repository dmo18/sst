# Wallboard URL and Yodeck options

Wallboard mode is configured through URL query parameters so a non-interactive display can be configured once and left running.

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
- The title row is compact.
- Payload age and browser-check age remain inline in the title row.
- A fixed provider-chip rail sits below the title.
- The provider rail loops horizontally when its content exceeds the available width.
- The incident list loops vertically when its content exceeds the available height.
- Incident details remain present.
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
- The vertical incident loop respects reduced-motion settings and becomes manually scrollable when reduced motion is enabled.

## Recommended Yodeck URL

```text
https://dmo18.github.io/sst/?view=wallboard&alerts=36h
```

This configuration displays only incidents updated during the last 36 hours and keeps the provider rail synchronized with that filtered set.