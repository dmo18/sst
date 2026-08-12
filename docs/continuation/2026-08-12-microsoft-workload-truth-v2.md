# Microsoft workload truth v2

Date: 2026-08-12
Status: CLOSED, production accepted
Baseline main: `a8161ba338189b9d128a036d38dfc56228301128`
Accepted implementation main: `6cd42c344b1e392148cda5b8402adcabc0678f27`

## Reported defect

The Microsoft experience still presented Microsoft 365 as though a single Microsoft public/Admin Center fallback signal could describe the health of the entire Microsoft 365 estate. The clearest symptom was a green Microsoft 365 public status card visually parenting Exchange Online, Teams, SharePoint, OneDrive, Intune, Microsoft 365 Apps, Defender for Microsoft 365, and Power Platform.

This was not cosmetic. The catalog, incident fallback, workload model, collector, and deployed verifier all contained assumptions that could overstate Microsoft health.

## Root causes

### 1. Clear public incident evidence looked like workload health

The public Microsoft source is useful for broadly published Microsoft incidents and fallback communications. The old Microsoft workspace rendered an operational public-source state as a positive green card, which implied broader health authority than the source actually has.

The corrected workspace treats a clear public source as informational. It can say that no public incident is currently published. It cannot green-light workloads or tenants.

### 2. The generic Microsoft provider aliased every workload

`config/provider-consolidation.json` configured the generic `microsoft365` provider with the Microsoft workload names in its `services` list.

That created two leaks:

- generic incident fallback could describe a Microsoft incident as affecting the entire configured Microsoft workload list;
- universal search could match Exchange, Teams, SharePoint, OneDrive, Entra, Intune, Apps, Defender, and Power Platform to the generic public-status provider even when no workload-specific evidence existed.

The generic source is now named `Microsoft 365 public status` and exposes only `Microsoft 365 public incident status` as its configured service.

### 3. Broad Microsoft incident tone propagated to every workload

The previous facet assessment used the generic `microsoft365` provider state for every Microsoft 365 workload. If that provider was degraded or major, every workload facet could inherit the same warning or critical tone even when the incident did not name that workload.

The new incident-scope mapper always maps a Microsoft public incident to the suite umbrella, then maps it to individual workloads only when the incident title, notes, affected-service text, or normalized affected-service label explicitly matches that workload.

Unmatched workloads remain informational and direct the operator to tenant Service Health.

### 4. Entra was treated as less tenant-dependent than the rest of Microsoft

Entra retains a useful dedicated Azure public signal, but a clear Azure public table does not prove tenant-specific sign-in, MFA, Conditional Access, application, or policy health. All ten Microsoft facets now count as tenant-authoritative for current tenant health.

### 5. The collector still converted an empty public RSS feed into operational Microsoft 365

After the first model and UI correction, direct inspection of release `31640958063` showed that the raw `microsoft365` provider still had:

- `service_state=operational`;
- green color;
- `truth_basis=confirmed-operational`.

The cause was `confirmHealthyFromFeed=true` on the Microsoft public incident RSS. This was corrected specifically for Microsoft. An empty readable Microsoft public feed now produces an available source with no service-health conclusion.

### 6. The deployed Microsoft verifier encoded the old service-state assumption

After the collector correction, production correctly produced `service_state=unknown` and `source_state=available`. The Microsoft workspace intentionally rendered this as informational because the public incident source was reachable, but the deployed verifier expected every unknown service state to render visually unknown.

The verifier now evaluates service state and source availability together and rejects any `is-positive` public Microsoft signal.

### 7. Legacy Chromium teardown could fail after a successful product probe

Release `31641929710` passed the actual pinned Chromium wallboard assertions and printed the successful 458x291 result, then failed while deleting Chromium cache files with `ENOTEMPTY`.

The renderer contract was not weakened. Browser-process shutdown and temporary-profile cleanup were hardened so a cache cleanup race cannot convert a passed product probe into a failed release.

## Final evidence model

The Microsoft workspace separates three evidence roles:

1. `Public incident fallback`: unauthenticated Microsoft public incident evidence. Clear is informational, never workload-positive.
2. `Azure public Entra signal`: broad Entra evidence. Active degradation can warn the Entra facet; clear does not prove tenant health.
3. `Tenant workload authority`: Microsoft 365 Service Health and Graph service communications for current subscribed-service health.

Every workload card carries `data-health-authority="tenant-service-health"`. Public incident counts are exposed separately with `data-public-incident-count`.

The ten tenant-authoritative facets are:

- Microsoft 365 suite;
- Exchange Online;
- Microsoft Teams;
- SharePoint Online;
- OneDrive for Business;
- Microsoft Entra ID;
- Microsoft Intune;
- Microsoft 365 Apps;
- Microsoft Defender for Microsoft 365;
- Microsoft Power Platform.

## Tenant Graph boundary

The private tenant contract remains:

- `GET /admin/serviceAnnouncement/healthOverviews`;
- `GET /admin/serviceAnnouncement/issues`;
- permission `ServiceHealth.Read.All`.

The public GitHub Pages build remains token-free. No tenant identifier, credential, private service communication, or tenant-only incident detail is exposed in the public bundle or `status.json`.

## PR #146: workload model and UI split

Pull request: #146, `Make Microsoft workload health tenant-authoritative`.

Final head: `592da9aa1d510ff483f00de17bc9ebad528386e9`.
Merge SHA: `6408c0a301186b16c171824f611aeca45aec51c3`.

Verification:

- pull-request checks `31640845011`: success;
- provider validation: success;
- quality gates: success;
- deterministic tests: success;
- TypeScript: success;
- real application build: success;
- dependency audit: success;
- CodeQL `31640845035`: success.

This PR separated the generic public source from individual workload names, introduced explicit public incident-to-workload scope mapping, made all ten workload facets tenant-authoritative, and redesigned the Microsoft workspace around public incident evidence versus tenant health.

## Rejected production evidence after PR #146

Release `31640958063` on `6408c0a301186b16c171824f611aeca45aec51c3` proved the catalog and UI split, but direct Pages artifact inspection found the residual collector overclaim. The raw Microsoft provider still emitted operational/green/confirmed-operational because the empty public RSS was allowed to confirm health.

This release is not accepted as final evidence.

## PR #147: collector no-health conclusion

Pull request: #147, `Stop clear Microsoft public feed from asserting health`.

Final head: `b9d63d78a0bd36a1ded8e70b35204efae5a629df`.
Merge SHA: `e5c350f524f96bf475b04e5b71bce9c1c74d214e`.

Verification:

- pull-request checks `31641359940`: success;
- deterministic Microsoft empty-feed regression: success;
- TypeScript: success;
- real application build: success;
- dependency audit: success;
- CodeQL `31641359910`: success.

The Microsoft public RSS now uses `confirmHealthyFromFeed=false`. Active public incidents still parse normally. An empty readable feed produces an available source with `service_state=unknown`, blue/informational posture, and an explicit no-health-conclusion message.

## Production evidence after PR #147

Release `31641459620` on `e5c350f524f96bf475b04e5b71bce9c1c74d214e` produced the intended raw Microsoft truth:

- name: `Microsoft 365 public status`;
- status: `Official public incident feed is readable; no active incident was found`;
- color: blue;
- `service_state=unknown`;
- `source_state=available`;
- `truth_basis=observed-no-conclusion`;
- source health: healthy;
- active incidents: 0;
- services: only `Microsoft 365 public incident status`;
- message explicitly says the feed does not confirm current component health and no operational conclusion was made.

The release passed Pages, current Chrome, pinned legacy Chromium, and exact 458x291 Yodeck. However, product-experience run `31641581393` stopped at the Microsoft verifier because that verifier still expected an unknown service state to render `is-unknown`. The UI correctly rendered the reachable public incident source as informational.

This product-experience run is not accepted as final evidence.

## PR #148: source-aware deployed Microsoft verifier

Pull request: #148, `Align Microsoft verifier with no-health conclusion`.

Final head: `f85146797700ee50e69447f79b30787035d1a1d5`.
Merge SHA: `3469eeef459c02ab15fdbdf9fb151a008a09abac`.

Verification:

- pull-request checks `31641828115`: success;
- TypeScript: success;
- real application build: success;
- dependency audit: success;
- CodeQL `31641828161`: success.

The Microsoft source cards now expose `data-source-state`. The deployed verifier mirrors the product tone contract:

- major service impact -> critical;
- degraded service impact -> warning;
- otherwise an available public source -> informational;
- unavailable source -> unknown.

Any positive public Microsoft card is rejected.

## Rejected production evidence after PR #148

Release `31641929710` on `3469eeef459c02ab15fdbdf9fb151a008a09abac` again produced the correct Microsoft payload. The actual pinned legacy Chromium probe also passed at 458x291, including structural content, geometry, overflow, and screenshot requirements.

The workflow then failed during temporary Chromium profile deletion with `ENOTEMPTY` in `Default/Cache/Cache_Data`. Yodeck was skipped because the legacy step exited nonzero after the successful product probe.

This release is not accepted as final evidence.

## PR #149: legacy verifier teardown hardening

Pull request: #149, `Make legacy wallboard cleanup non-fatal`.

Final head: `0cf94efe856bcdaae7917bf6ca4b2af44675ea13`.
Merge SHA: `6cd42c344b1e392148cda5b8402adcabc0678f27`.

Verification:

- pull-request checks `31642160706`: success;
- deterministic legacy cleanup regression: success;
- TypeScript: success;
- real application build: success;
- dependency audit: success;
- CodeQL `31642160732`: success.

Rendering assertions remain unchanged. Teardown now waits for browser exit after SIGKILL when necessary, retries recursive cleanup, and logs a cleanup warning instead of overriding an already successful product probe.

## Accepted production release

Release `31642257830`, release #888, on implementation main `6cd42c344b1e392148cda5b8402adcabc0678f27` is accepted.

Build and collection passed:

- provider validation;
- repository quality gates;
- deterministic tests;
- strict TypeScript;
- dependency audit;
- fresh public status collection;
- browser payload compatibility;
- truth, coverage, and freshness verification;
- verified application build;
- Pages artifact publication.

Deployment passed:

- GitHub Pages deployment;
- deployed asset/payload smoke test;
- current Chrome enterprise workspace render;
- published pre-Cascade-Layers Chromium resolution;
- pinned legacy Chromium wallboard runtime;
- exact 458x291 Yodeck wallboard contract;
- Yodeck artifact upload;
- deployed intelligence verification.

Current-main CodeQL `31642257828`: success.

### Accepted Microsoft payload

Pages artifact `9159331451` was inspected directly. Generated payload timestamp: `2026-08-12T21:23:36.935Z`.

`microsoft365` reports:

- name `Microsoft 365 public status`;
- status `Official public incident feed is readable; no active incident was found`;
- color blue;
- `service_state=unknown`;
- `source_state=available`;
- `truth_basis=observed-no-conclusion`;
- source confidence medium;
- source health healthy;
- active incident count 0;
- problem component count 0;
- services exactly `Microsoft 365 public incident status`.

This proves the public Microsoft source itself no longer claims operational Microsoft 365 health when the public incident feed is merely clear.

`entra` continues to expose the separate Azure public Entra signal. Its public table can report broad Entra state, but the Microsoft workspace renders that source as informational evidence and does not use it as tenant-specific health.

## Accepted product-experience evidence

Product-experience run `31642398270`, run #76, completed successfully after release #888.

All deployed product gates passed:

- browser live status truth;
- premium operator experience;
- Product Depth command system;
- Microsoft 365 critical coverage;
- provider identity and NUSO.

Evidence artifact: `9159385364`.
Digest: `sha256:dde53c7fa14ee6bb851f565d076934d6ffce0710aa499caae37108558571b510`.

The Microsoft verifier recorded:

`MICROSOFT365_CRITICAL facets=10 tenant_authoritative=10 desktop=459889 mobile=163141`

`MICROSOFT365_PUBLIC_SIGNAL microsoft365=unknown/available/m365-source-card is-informational role=public-incident-fallback evidence=healthy entra=operational/available/m365-source-card is-informational role=azure-public-entra evidence=watch`

`MICROSOFT365_EVIDENCE public-incidents=supplemental; workload-health=tenant-authoritative; clear-public-signal-does-not-greenlight-workloads`

## Direct visual acceptance

Desktop `operator-m365.png` was reviewed directly.

Accepted observations:

- no green Microsoft 365 umbrella card;
- top Microsoft 365 card is neutral blue and labeled `Public incident fallback`;
- the card says the public incident feed is reachable with 0 active incidents and explicitly says it is not workload health;
- Entra is a separate neutral public signal and says it is not tenant health;
- `Microsoft 365 Service Health` is visually separate and labeled `Tenant workload authority`;
- the matrix says `10 tracked facets · 10 tenant-authoritative`;
- Microsoft 365 suite says a clear public feed is not a workload-health assertion;
- Exchange, Teams, SharePoint, OneDrive, and the remaining workloads say current health requires tenant Microsoft 365 Service Health unless scoped public incident evidence exists;
- the right rail clearly explains that public incident feeds are not workload health and that tenant Service Health is the authority.

Mobile `operator-m365-mobile.png` was also reviewed directly. The same evidence separation remains readable and intact at mobile width with no green umbrella inheritance.

## Permanent contract

1. Microsoft is not one health state.
2. A clear unauthenticated Microsoft public incident source is informational evidence only.
3. `microsoft365` must not use an empty public incident feed to claim operational Microsoft 365 health.
4. The generic Microsoft public provider must expose only `Microsoft 365 public incident status` as its service identity.
5. Public Microsoft incidents can affect the suite umbrella, but individual workload warnings require explicit published workload scope.
6. All ten Microsoft workload facets are tenant-authoritative for current tenant health.
7. A clear Azure public Entra signal does not prove tenant-specific Entra health.
8. Current tenant workload health requires Microsoft 365 Service Health or Graph service communications from a private authenticated backend.
9. The public GitHub Pages pipeline remains token-free and must not expose tenant identifiers, credentials, or tenant-only communications.
10. Deployed verification must reject any positive public Microsoft card and any return of the old generic operational umbrella presentation.

This record is closed.
