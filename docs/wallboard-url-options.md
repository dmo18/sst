# Wallboard URL options

Wallboard mode is controlled by URL query parameters so a non-interactive display can be configured once and left running.

## Alert window

Use `alerts=NUMBERm`, `alerts=NUMBERh`, or `alerts=NUMBERd` to show only vendor incidents whose latest update falls within that rolling window.

Examples:

- `?view=wallboard&alerts=90m`
- `?view=wallboard&alerts=36h`
- `?view=wallboard&alerts=2d`

The supported range is one minute through 30 days. If `alerts` is omitted or invalid, wallboard shows all active vendor incidents in the payload.

The filter applies to both the vertical priority-signal marquee and the horizontal alert-provider rail. The cutoff is recalculated against the browser clock, so an incident disappears automatically when its latest update ages beyond the selected window.
