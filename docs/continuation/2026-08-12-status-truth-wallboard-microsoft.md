# Status truth, wallboard, and Microsoft reliability continuation record

Date: 2026-08-12
Status: closed, production accepted
Baseline main: `9bda370bbe52578df34a0642bf5fbe26868cd2a0`
Primary implementation PR: #140, `Harden live status truth, Microsoft coverage, and wallboard telemetry`
Yodeck readiness follow-up PR: #141, `Wait for wallboard freshness before Yodeck acceptance`
Accepted implementation main: `4e5d16533d5c028c054164d748b0af50bcac4a93`
Accepted production release: #867, run `31610194911`
Accepted product verification: run `31610444476`

## Why this stream existed

Four production defects were treated as release blocking:

1. the wallboard header no longer exposed absolute last-update and browser-refresh timing;
2. compact wallboard alert-provider icons could remain static when multiple providers fit within the rail;
3. Microsoft Entra could look degraded even while Microsoft publicly reported it operational because evidence health was being treated as service health;
4. a newly opened Claude incident was not visible in SST because collection completed immediately before the vendor created the incident and there was no low-latency truth recovery path for a fresh-but-now-wrong payload.

The stream was not closed from source review. Closure required current production data, modern and legacy browser validation, exact 458x291 signage verification, independent Claude official-state comparison, Microsoft service/evidence consistency checks, and direct screenshot review.

## Root causes and resolutions

### Claude incident timing and detection confidence

The pre-fix collection checked Anthropic at `2026-08-12T13:49:38.017Z` and generated the payload at `2026-08-12T13:49:53.565Z`.

Claude then created incident `rk6gkg2gwfny`, `Degraded performance for multiple models`, at `2026-08-12T13:50:28.458Z`, about 35 seconds after payload generation. The production `parseStatuspageSummary()` parser correctly interpreted the later official Claude summary as active. The miss was therefore a collection timing and recovery failure, not a Claude parser-format failure.

Validation also showed GitHub scheduled workflows can themselves run late, so a more frequent cron could not be the sole answer.

The accepted architecture now has two truth layers:

- Layer 1 is the audited static `status.json` collection. It remains the durable validated baseline.
- Layer 2 is a nonblocking browser live-truth overlay for configured standardized official Statuspage JSON sources.

`src/liveStatusTruth.ts` re-observes standard `/api/v2/summary.json` provider sources after the audited payload has already rendered. Successful observations can surface a newly opened incident or clear a stale resolved one. Failed live observations leave the audited static provider and incident rows untouched.

`src/usePayloadPoller.ts` owns static and live requests separately. Static validation and rendering happen first. A newer static refresh cancels older live work, and slow or broken CORS origins do not hold the operator UI hostage.

`src/dataLifecycle.ts` has an explicit overlay action that cannot create data before static validation succeeds and cannot erase a stale-payload warning.

`vite.config.ts` derives the browser `connect-src` allowlist from exact configured official Statuspage origins. It does not enable arbitrary HTTPS access. Provider artwork remains local and does not use runtime external image requests.

`scripts/status-truth-watch.mjs` and `.github/workflows/status-freshness-watch.yml` remain a durable server-side recovery path. They compare the deployed payload against current official structured truth and can dispatch one refresh for newly opened, cleared, or changed official incidents, unless another release is already active.

`scripts/verify-live-status-truth.mjs` independently fetches Claude's official current summary and compares it with the deployed browser result. The production gate requires Anthropic to be successfully observed and browser active/clear state to match the direct official result.

### Microsoft Entra ghost issues and Microsoft coverage semantics

The pre-fix deployed Entra record was operational and confirmed operational, but its source evidence health was `watch`. The UI promoted that evidence-quality warning into a service warning.

`src/microsoft365Coverage.ts` now separates service truth from evidence truth:

- `microsoft365ServiceTone()` derives only from `serviceState`;
- `microsoft365EvidenceTone()` derives from source availability and source evidence health;
- evidence `watch` or `blind` cannot create a warning or critical service state.

The Microsoft 365 model also stopped overclaiming. A clear broad Microsoft 365 feed means no broad public Microsoft incident is active. It does not mean Exchange Online, Teams, SharePoint Online, OneDrive, Intune, Microsoft 365 Apps, Defender for Microsoft 365, and Power Platform have each been independently publicly verified healthy. Those umbrella-only facets remain informational until tenant or service-specific evidence exists.

Microsoft Entra retains its dedicated public service signal. Tenant-specific Microsoft Graph service communications remain an explicit private evidence boundary.

`src/Microsoft365CriticalSuite.tsx` exposes service state and evidence state separately for production verification, includes current public Microsoft/Entra incident evidence, and labels the tenant Graph boundary clearly.

`scripts/verify-microsoft365-experience.mjs` dynamically proves an operational source renders positive even when its evidence tone is watch.

### Wallboard update and refresh timing

`WallboardV2` now receives the actual browser refresh interval and exposes:

- absolute payload `Updated` time in Eastern Time;
- absolute browser `Checked` time;
- absolute `Next` browser refresh time;
- browser refresh cadence.

The compact 458x291 heading also preserves payload age, browser-check age, and refresh cadence.

The wallboard shell publishes machine-verifiable update, check, and cadence attributes. The exact Yodeck verifier requires those values before acceptance.

### Wallboard provider rotation

The compact alert-provider rail now loops whenever more than one provider is active, independent of whether the chips overflow the viewport.

`scripts/verify-yodeck-wallboard.mjs` samples the rendered transform twice and requires actual movement whenever multiple providers are present. A CSS class by itself is no longer enough to pass.

### Provider artwork build resilience found during this stream

The first reliability pull-request build passed deterministic tests and TypeScript but stopped at 34 of 35 provider artwork identities because a Jamf status-site request terminated transiently. The release gate correctly failed.

The 35-provider requirement was not weakened. Jamf now uses its already-verified official Statuspage artwork asset directly, and transient artwork fetches retry network errors, HTTP 408, 425, 429, and 5xx responses up to three attempts with short backoff.

## Pull-request and production history

### PR #140

Final head: `3ae4aa678e53febd023dfc7c066e75a7c2f5bfcd`

Final pull-request checks:

- pull-request run `31609454847`, success;
- CodeQL run `31609454860`, success.

Merge SHA: `e0abe5f04e0578883107edaa13bdfe0f1e3f5007`.

Earlier PR history deliberately retained useful failures:

- run `31607302240` stopped at the 34/35 Jamf artwork failure;
- run `31607663278` passed after artwork resilience hardening, with 35/35 artwork and main JavaScript at 328.40 kB minified, 118.62 kB gzip;
- run `31608505346` stopped when TypeScript rejected non-canonical `yellow` status colors. The runtime and fixtures were corrected to canonical `amber`; no type suppression was added.

### Rejected production release #866

Run `31609594986` published successfully enough for deployed asset smoke, current Chrome rendering, and pinned legacy Chromium to pass, but exact 458x291 Yodeck verification failed.

Failure:

`Wallboard freshness timestamps are incomplete: updated=missing checked=missing refreshMs=180000`

The layout probe had already reported pass during React's initial empty render, before audited payload freshness fields arrived. Release #866 was rejected. The gate was not weakened.

### PR #141

PR #141 fixed the Yodeck readiness race by requiring resolved layout plus real payload update time, browser-check time, and refresh cadence before the exact-signage verifier begins acceptance assertions.

Final head: `d7e4fcf3a769bee63be4920191d9a79d1f22ffdb`

Pull-request checks:

- pull-request run `31610059615`, success;
- CodeQL run `31610059675`, success.

Merge SHA: `4e5d16533d5c028c054164d748b0af50bcac4a93`.

## Accepted production evidence

### Release #867

Run `31610194911` completed successfully from implementation main `4e5d16533d5c028c054164d748b0af50bcac4a93`.

The full release passed:

- fresh official provider collection;
- provider and payload validation;
- truth and freshness validation;
- verified application build;
- Pages deployment;
- deployed asset/payload smoke;
- current Chrome render;
- pinned legacy Chromium runtime;
- exact 458x291 Yodeck verification.

Post-merge CodeQL run `31610195014` also completed successfully.

Deployed smoke reported 80 of 80 live sources, zero blind spots, and four active incidents affecting four providers at the accepted run.

### Exact 458x291 Yodeck proof

Yodeck artifact:

- artifact id `9146922697`;
- name `yodeck-wallboard-31610194911`;
- digest `sha256:d322475f393acd261baa544bad3e605c309a5599234101754710c043f84f2ffe`.

Accepted verifier output:

`YODECK_VIEWPORT 458x291 dpr=1`

`YODECK_LAYOUT_PROBE pass`

`YODECK_LAYOUT_DETAIL viewport:458x291;signals:4;providers:4`

`YODECK_READINESS updated=2026-08-12T15:03:50.797Z checked=1755011153026 refresh_ms=180000`

`YODECK_PROVIDER_ROTATION providers=4 looping=true moved=true required=true`

`YODECK_FRESHNESS updated=2026-08-12T15:03:50.797Z checked=1755011153026 refresh_ms=180000`

The retained compact frame was directly reviewed and accepted. It visibly showed `Payload 2m`, `Browser 0s`, and `Refresh 3m`. The retained DOM also contained the full absolute header contract: `Updated 11:03:50 AM`, `Checked 11:05:53 AM`, `Next 11:08:53 AM`, `Browser refresh 3m`.

### Claude dual-layer proof

The fresh static collector independently caught the Claude incident. Published `status.json` contained:

- Anthropic `service_state=degraded`;
- `truth_basis=vendor-incident`;
- `source_health=healthy`;
- one active incident;
- four affected Claude surfaces;
- incident id `anthropic:rk6gkg2gwfny`;
- title `Degraded performance for multiple models`;
- status `investigating`;
- affected service `claude.ai, Claude API (api.anthropic.com), Claude Code, Claude Cowork`.

The browser live-truth layer independently agreed with the official current Claude state during post-deploy verification:

`LIVE_TRUTH_COVERAGE attempted=41 successes=38 failures=3 checked=2026-08-12T15:07:26.760Z`

`LIVE_TRUTH_CLAUDE official=active browser=active indicator=minor incidents=rk6gkg2gwfny components=claude.ai,Claude API (api.anthropic.com),Claude Code,Claude Cowork`

`LIVE_TRUTH_ACTIVE_PROVIDERS anthropic,jumpcloud,tailscale,huntress`

Browser live coverage was 38 of 41 successful observations, about 92.7 percent, above the 75 percent production floor. Anthropic was one of the successful observations. The three failed browser live observations were fail-preserving and did not clear or overwrite their audited static states.

### Microsoft production proof

Post-deploy product run `31610444476` completed successfully.

Microsoft output:

`MICROSOFT365_CRITICAL facets=10 desktop=412755 mobile=145467`

`MICROSOFT365_SERVICE_TRUTH microsoft365=operational/m365-source-card is-positive evidence=healthy entra=operational/m365-source-card is-positive evidence=watch`

`MICROSOFT365_EVIDENCE public-broad + dedicated-entra; tenant-detail=private-graph-required; evidence-health-does-not-set-service-tone`

This is the direct production proof for the Entra ghost-state defect: Entra was operational and rendered positive while its evidence tone remained watch.

Desktop and mobile Microsoft screenshots were directly reviewed. The service/evidence distinction was readable, Entra was green, broad Microsoft 365 facets did not claim individual tenant health, and the private Graph boundary was explicit.

### Broader product verification

Product artifact:

- artifact id `9146957173`;
- name `product-experience-31610194911`;
- size `3,768,139` bytes;
- digest `sha256:a9acb5a8ed5b2893b0efe478e62bfa1a550cc7a2b221b1c69f218f5d1cfb5adf`.

Run `31610444476` passed:

- deployed browser live status truth;
- premium operator experience;
- Product Depth;
- Microsoft 365 critical coverage;
- provider identity and NUSO;
- evidence upload.

Provider verification still reported 80 providers, 35 exact masks, 35 favicon-backed identities, zero generated fallbacks, 80 local assets, and NUSO visible on mobile.

## Closure decision

All four reported defects are closed in accepted production:

1. wallboard update/check/next-refresh timing is restored and production verified;
2. multi-provider wallboard rotation is actual movement, not just animation markup;
3. Entra evidence-health watch no longer creates a ghost service warning, and Microsoft broad-versus-tenant evidence semantics are explicit;
4. Claude-style newly opened Statuspage incidents are covered by both durable collection and a nonblocking live browser truth layer, with a production comparison against Claude's direct official state.

The work also hardened provider-artwork release reliability and the Yodeck readiness verifier without lowering existing gates.

## Retained limitations and continuation contract

The browser live-truth overlay intentionally covers standardized official Statuspage JSON providers only. Non-Statuspage sources still rely on their dedicated durable collector adapters and the server-side truth watcher where implemented. Do not generalize browser network access without a provider-specific, first-party, structured, CORS-safe contract and exact-origin CSP review.

Preserve these contracts in future work:

- static payload validation remains the audited baseline and renders before live vendor work;
- browser live truth is first-party, structured, exact-origin, nonblocking, provider-scoped, and fail-preserving;
- failed live observations never clear an audited incident;
- scheduled truth-drift recovery remains a fallback but is not the only Statuspage detection mechanism;
- Microsoft service truth and evidence quality remain separate;
- broad Microsoft 365 public clear state never becomes a claim of facet-specific tenant health;
- wallboard freshness includes absolute update/check/next times plus cadence;
- more than one active wallboard provider means the provider rail must actually move;
- exact Yodeck acceptance waits for loaded freshness state before evaluating the frame;
- provider artwork remains 35 of 35 and runtime external image fetches remain prohibited;
- substantial changes to these contracts require production evidence and an updated continuation record.
