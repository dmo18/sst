# Status truth, wallboard, and Microsoft reliability continuation record

Date: 2026-08-12
Status: implementation in progress
Baseline main: `9bda370bbe52578df34a0642bf5fbe26868cd2a0`
Branch: `agent/status-truth-wallboard-microsoft-2026-08-12`
Pull request: #140, `Harden live status truth, Microsoft coverage, and wallboard telemetry`

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

The production `parseStatuspageSummary()` parser correctly interpreted the later official Claude summary as an active issue. The miss was therefore a collection timing and recovery failure, not a Claude parser-format failure.

### Scheduler delay exposed a second failure mode

The first recovery design improved the freshness workflow so a fresh-but-wrong payload could trigger a collection when official truth changed. During validation, GitHub's scheduled workflows themselves ran late enough that neither the full collector nor the fallback watcher could be treated as a low-latency detection boundary.

That changed the architecture. Scheduled collection remains the audited durable baseline, and scheduled truth-drift recovery remains a useful fallback, but the operator browser now performs a constrained first-party live truth overlay for standardized Statuspage vendors. The product no longer waits for GitHub scheduler timing before it can surface a newly opened or newly cleared Statuspage incident.

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

### Provider artwork build fragility found during this stream

The first full pull-request build passed all deterministic tests and TypeScript but stopped at 34 of 35 provider artwork identities because a single Jamf status-site request terminated transiently. The 35-provider release gate correctly failed.

The gate was not weakened. Jamf now uses its already-verified official Statuspage artwork asset directly, and the artwork fetcher retries transient network failures, HTTP 408, 425, 429, and 5xx responses up to three attempts with short backoff. The release requirement remains 35 of 35.

## Implementation

### Layer 1: audited static collection

The existing signed/validated `status.json` remains the durable application baseline. Browser payload schema, catalog hash, provider count, size limits, freshness, and compatibility are still validated before the application trusts it.

The UI renders this validated static payload immediately. It does not wait for any vendor-side live request.

### Layer 2: nonblocking browser live official truth

`src/liveStatusTruth.ts` re-observes standardized official Statuspage JSON sources after the audited payload has rendered.

The live layer:

- targets only configured providers whose source is the standard `/api/v2/summary.json` Statuspage endpoint;
- uses CORS with credentials omitted and no referrer;
- uses bounded concurrency and a six-second per-source timeout compatible with the pinned legacy Chromium runtime;
- treats current unresolved incidents, overall Statuspage indicator, and current component states as service truth;
- replaces static incident rows only for providers successfully re-observed;
- can surface an incident opened after static collection or clear one that has since resolved;
- leaves the audited static provider and its incidents untouched when a live request fails or cannot be parsed;
- records live check time, attempted/success/failure counts, active provider ids, and per-provider observation success.

`src/usePayloadPoller.ts` has independent request ownership for static payload work and live truth work. Static success is dispatched first. A new static refresh cancels an older live overlay, and component unmount cancels both owners. Slow or broken vendor CORS therefore cannot block initial rendering and stale async live work cannot overwrite a newer static payload.

`src/dataLifecycle.ts` has an explicit `overlay` action. An overlay cannot create data before the audited payload exists, and an overlay preserves a stale-payload failure state rather than pretending a stale static collection became fresh merely because some live vendor requests succeeded.

### Exact-origin CSP contract

`vite.config.ts` derives the browser `connect-src` allowlist from enabled configured `statuspage` provider source origins at build time. The generated CSP adds only those exact official Statuspage origins. It does not permit arbitrary `https:` network access.

This intentionally changes the old zero-runtime-vendor-request assumption only for machine-readable status truth. Provider artwork remains local build output and does not use runtime external image requests.

### Scheduled live official truth drift recovery

`scripts/status-truth-watch.mjs` independently compares the deployed payload with current official structured truth:

- every deployed `statuspage-json` provider using the production `parseStatuspageSummary()` parser;
- Microsoft Entra using the production `parseAzureEntraStatus()` adapter.

The watcher detects:

- official source changed from clear to active;
- official source changed from active to clear;
- the active official incident-id set changed while the provider remained affected.

Unknown or limited parser results do not clear an incident. Individual live-source request failures are logged and do not synthesize service truth.

`.github/workflows/status-freshness-watch.yml` runs the live truth comparison in addition to payload-age recovery. If the payload is stale or official truth drift exists, it dispatches exactly one full refresh unless a release is already queued or active. This workflow is a durable recovery mechanism, not the only low-latency detection path.

### Deployed live-truth verification

`scripts/verify-live-status-truth.mjs` independently fetches Claude's current official Statuspage summary from the verifier runner, then launches the deployed application and reads the browser live-truth evidence exposed on the application root.

The deployed gate requires:

- a valid browser live-truth timestamp;
- at least ten standardized providers attempted;
- consistent attempted/success/failure accounting;
- at least 75 percent successful browser live truth coverage;
- Anthropic successfully observed in the browser;
- the browser's current Anthropic active/clear state to equal Claude's direct official current state;
- when Claude currently has an unresolved incident title, at least one current official title to appear in the deployed DOM.

This check runs before the broader premium product evidence workflow. It is specifically designed to catch a recurrence of the reported Claude failure even when `status.json` itself is still fresh.

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

The layout probe requires the loop class whenever more than one provider exists. `scripts/verify-yodeck-wallboard.mjs` samples the rendered transform twice and fails if a required provider rail does not actually move.

The same production verifier validates the wallboard freshness header contract and timing data attributes.

## Regression coverage

- `src/__tests__/liveStatusTruth.test.ts` verifies a fresh static clear Claude state can be promoted by an incident opened seconds later, a successful live clear can remove a stale incident, canonical degraded color remains `amber`, and failed live observations leave static truth untouched.
- `src/__tests__/lifecycle.test.ts` verifies overlays preserve stale-payload warnings and cannot create data before static validation succeeds.
- `scripts/__tests__/status-truth-watch.test.js` includes a Claude-shaped active Statuspage fixture and verifies opened, cleared, and changed incident-set drift detection, scheduler-independent browser live truth, exact-origin CSP generation, nonblocking overlay ownership, and deployed Claude comparison requirements.
- The same tests lock the rule that `source_health=watch` does not create an Entra service incident.
- Wallboard runtime contract tests require absolute header timing, refresh cadence, continuous multi-provider rotation, and production movement verification.
- Microsoft critical coverage tests require service/evidence separation and prohibit umbrella clear state from becoming facet-specific public health claims.
- Microsoft production verification dynamically checks that an operational source card renders positive even when its evidence tone is watch.
- Provider favicon tests retain the 35-provider gate and cover retry policy plus the pinned Jamf official asset.

## Pull-request verification history

### First reliability build

Pull-request run `31607302240` passed provider validation, repository quality, 346 deterministic tests, and TypeScript, then failed at application build because Jamf artwork resolved 34 of 35 after a transient network termination. The release gate correctly stopped the build.

### Artwork-hardened build

Pull-request run `31607663278` passed provider validation, repository quality, 347 deterministic tests, TypeScript, application build, and dependency audit. Artwork sync returned 35 of 35 with zero failures. The main JavaScript bundle was 328.40 kB minified, 118.62 kB gzip. CodeQL run `31607663304` succeeded.

### First browser-live-truth build

Pull-request run `31608505346` passed provider validation, repository quality, and 350 deterministic tests, then TypeScript rejected five uses of the non-canonical color name `yellow`. The application contract permits `green`, `amber`, `red`, and `blue`. Runtime and fixtures were corrected to `amber`; no type suppression was added.

### Current pull-request head

Current head: `8a0dff4d19e2fa90991900f79a2d7c408dd3ae58`.

Pull-request run `31609201112` has passed provider validation, repository quality, deterministic tests, TypeScript, application build, and dependency audit on the static-first nonblocking browser-live-truth architecture. Current-head CodeQL run `31609201004` is the remaining pre-merge gate at the time of this update.

## Required completion evidence

Do not close this stream until all of the following are true:

1. current-head pull-request provider validation, quality, deterministic tests, TypeScript, real application build, audit, and CodeQL pass;
2. after merge, the full Pages release and deployed smoke/render/legacy/Yodeck stack pass;
3. deployed browser live truth meets its 75 percent coverage floor, successfully observes Anthropic, and agrees with Claude's direct official current active/clear state;
4. if Claude remains active, the deployed product renders a current official Claude incident title; if Claude resolves before verification, both the official verifier and browser overlay agree that it is clear;
5. Yodeck logs prove freshness timestamps are present and the provider rail moves whenever multiple active providers exist;
6. post-deploy Microsoft verification proves operational Entra is not rendered as a warning solely because evidence health is watch;
7. direct wallboard and Microsoft screenshots are reviewed, not merely accepted from structural CI;
8. final PR head, merge SHA, pull-request run IDs, production release run, post-merge CodeQL, product-experience run, artifact IDs, live-truth output, Microsoft truth output, Yodeck telemetry, and visual observations are appended here before closure.

## Continuation point

If work resumes from this record before closure, preserve these contracts:

- static payload validation is the audited baseline and renders before live vendor work;
- browser live truth is first-party, structured, exact-origin, nonblocking, provider-scoped, and fail-preserving;
- failed live observations never clear an audited incident;
- scheduled truth-drift recovery remains a fallback but is not the only detection mechanism;
- Microsoft service truth and evidence quality stay separate;
- broad Microsoft 365 public clear state never becomes a claim of facet-specific tenant health;
- wallboard freshness includes absolute update/check/next times plus cadence;
- more than one active wallboard provider means the provider rail must actually move;
- provider artwork remains 35 of 35 and runtime external image fetches remain prohibited;
- substantial changes to these contracts require this continuation record to be updated with production evidence.
