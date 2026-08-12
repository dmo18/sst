# Status truth, wallboard, and Microsoft reliability continuation record

Date: 2026-08-12
Status: implementation in progress
Baseline main: `9bda370bbe52578df34a0642bf5fbe26868cd2a0`
Branch: `agent/status-truth-wallboard-microsoft-2026-08-12`

## Why this stream exists

A production review identified four release-blocking reliability defects after the prior product cleanup:

1. the wallboard header no longer exposed absolute last-update and browser-refresh timing;
2. compact wallboard alert-provider icons could remain static when multiple providers fit within the rail;
3. Microsoft Entra could look degraded even while Microsoft publicly reported it as operational because source evidence health was being treated as service health;
4. a newly opened Claude incident was not visible in SST because the scheduled collection completed immediately before the vendor created the incident and no truth-drift recovery path existed for a fresh-but-now-wrong payload.

The acceptance target for this stream is not source-level correctness alone. The deployed site must prove accurate current incident truth, explicit freshness timing, moving wallboard provider rotation, Microsoft service/evidence separation, and recovery behavior that can detect vendor truth changes between full collections.

## Baseline evidence

### Claude race

The last deployed collection before the report checked Anthropic at `2026-08-12T13:49:38.017Z` and generated the payload at `2026-08-12T13:49:53.565Z`.

Claude's official Statuspage then created incident `rk6gkg2gwfny`, `Degraded performance for multiple models`, at `2026-08-12T13:50:28.458Z`. The incident affected claude.ai, the Claude API, Claude Code, and Claude Cowork. The deployed Anthropic record was therefore truthful when collected but stale relative to a vendor event created about 35 seconds after payload generation.

The existing freshness workflow only recovered when the entire deployed payload became older than 20 minutes. A payload could therefore remain formally fresh while materially wrong about a newly opened or newly cleared incident.

### Entra ghost state

The deployed Entra record was:

- `service_state=operational`
- `truth_basis=confirmed-operational`
- public component `Non-Regional=Good`
- `source_state=available`
- `source_health=watch`
- `source_confidence=low`

The Microsoft coverage UI classified `source_health=watch` as a service warning. This conflated evidence quality with vendor service state and produced a ghost issue even though the adapter and payload were operational.

### Wallboard freshness regression

`App.tsx` retained the wallboard browser refresh interval, but `WallboardV2` received only the last browser-check timestamp. The header showed a clock, lifecycle state, and relative payload age, while absolute payload update, browser check, next browser refresh, and cadence were absent.

### Provider rotation regression

`useProviderMarquee()` only enabled the provider animation when multiple providers existed and their combined chip width overflowed the viewport. When two or more active providers fit in the rail, the row was static. The existing 458x291 verifier checked the CSS class only when overflow existed and never measured actual movement.

## Implementation

### Live official truth drift recovery

`scripts/status-truth-watch.mjs` compares the deployed payload with current official structured truth:

- every deployed `statuspage-json` provider using the production `parseStatuspageSummary()` parser;
- Microsoft Entra using the production `parseAzureEntraStatus()` adapter.

The watcher detects:

- official source changed from clear to active;
- official source changed from active to clear;
- the active official incident-id set changed while the provider remained affected.

Unknown or limited parser results do not clear an incident. Individual live-source request failures are logged and do not synthesize service truth.

`.github/workflows/status-freshness-watch.yml` now runs the live truth comparison in addition to payload-age recovery. If the payload is stale or official truth drift exists, it dispatches exactly one full refresh unless a release is already queued or active.

### Microsoft service truth versus evidence truth

`src/microsoft365Coverage.ts` now has separate service and evidence classifications:

- `microsoft365ServiceTone()` derives only from `serviceState`;
- `microsoft365EvidenceTone()` derives from source availability and source health;
- evidence `watch` or `blind` can no longer create a service warning or critical state.

Umbrella-only Microsoft 365 facets no longer claim individual public operational status. When the broad Microsoft source is clear:

- the Microsoft 365 suite can say no broad public incident is active;
- individual Exchange, Teams, SharePoint, OneDrive, Intune, Apps, Defender, and Power Platform facets remain informational because tenant/facet-specific health is not publicly verified;
- Entra retains its dedicated public service state;
- tenant-specific Microsoft Graph remains the explicit private truth boundary.

The Microsoft workspace now includes current public Microsoft/Entra incident evidence and exposes service-state/evidence-state attributes for post-deploy consistency checks.

### Wallboard freshness header

`WallboardV2` receives the browser refresh interval and exposes:

- absolute payload `Updated` time in Eastern Time;
- absolute browser `Checked` time;
- absolute `Next` browser refresh time;
- browser refresh cadence.

The compact wallboard priority heading keeps payload age, browser-check age, and refresh cadence.

### Provider rotation

The compact alert-provider rail now loops whenever more than one provider is active, independent of whether the chips overflow the viewport.

The layout probe requires the loop class whenever more than one provider exists. `scripts/verify-yodeck-wallboard.mjs` now samples the rendered transform twice and fails if a required provider rail does not actually move.

The same production verifier validates the wallboard freshness header contract and timing data attributes.

## New regression coverage

- `scripts/__tests__/status-truth-watch.test.js` includes a Claude-shaped active Statuspage fixture and verifies opened, cleared, and changed incident-set drift detection.
- The same tests lock the rule that `source_health=watch` does not create an Entra service incident.
- Wallboard runtime contract tests require absolute header timing, refresh cadence, continuous multi-provider rotation, and production movement verification.
- Microsoft critical coverage tests require service/evidence separation and prohibit umbrella clear state from becoming facet-specific public health claims.
- Microsoft production verification dynamically checks that an operational source card renders positive even when its evidence tone is watch.

## Required completion evidence

Do not close this stream until all of the following are true:

1. pull-request provider validation, quality, deterministic tests, TypeScript, real application build, audit, and CodeQL pass;
2. the branch watcher can evaluate the live Claude incident with the production parser and identify truth drift against the stale baseline payload;
3. after merge, the full Pages release and deployed smoke/render/legacy/Yodeck stack pass;
4. Yodeck logs prove freshness timestamps are present and the provider rail moves whenever multiple active providers exist;
5. post-deploy Microsoft verification proves operational Entra is not rendered as a warning solely because evidence health is watch;
6. the deployed payload catches the active Claude incident if it remains open, or accurately records its resolved state if Claude clears it before deployment;
7. direct wallboard and Microsoft screenshots are reviewed, not merely accepted from structural CI;
8. final run IDs, artifact IDs, status-truth output, visual observations, and merge SHA are appended here before closure.
