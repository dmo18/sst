# Maintenance is context, not an alert

Date: 2026-08-12
Status: Closed
Baseline main: `9488cf75741339a3b646098c0effc0109a1170b0`
Initial branch: `agent/maintenance-is-context-not-alert-2026-08-12`
Initial pull request: #143, `Keep maintenance context out of alerts`
Initial merge: `728a9ae9f7d38ab86a4f7e7f262feecd0be35dcd`
Follow-up branch: `fix/backblaze-maintenance-incident-promotion-2026-08-12`
Follow-up pull request: #144, `Stop FireHydrant maintenance from becoming incidents`
Accepted product implementation: `e082ff8efe9e391683d375a2d88e8ab860fd973c`

## Reported production defect

Backblaze appeared with `CA East Core Services Maintenance - 8/12/2026` in a priority-oriented product surface even though scheduled maintenance is not an active service incident.

The review ultimately found three independent semantic leaks. The first two were fixed in PR #143. Production release `31637357593` then exposed a third Backblaze FireHydrant edge case before this stream was closed.

### 1. Maintenance leaked into the shared action queue

The collector already modeled incidents and maintenance separately, and the wallboard Priority Signals list already filtered its displayed rows to incident action items only. However, `src/statusViewModel.ts` promoted every `in_progress` maintenance record into the shared operator `actionQueue` with `attention=action` and a priority score.

That made routine maintenance eligible for other priority/action surfaces and contradicted the product contract.

Resolution:

- maintenance remains in `IssueConsoleModel.maintenance`;
- maintenance counts and maintenance-specific filtering remain available;
- `buildActionQueue()` no longer accepts or emits maintenance records;
- incident, source-health, and schema actions remain unchanged;
- an in-progress maintenance window by itself produces no operator action.

### 2. Backblaze `CA East` was not recognized as Canada

The Backblaze FireHydrant adapter already runs maintenance records through the shared US region-scope policy. The generic policy recognized explicit `Canada`, cloud-region tokens, and several compact vendor cell names, but did not recognize the human-readable Backblaze label `CA East`.

Because the label had neither an explicit US marker nor a recognized non-US marker, it was treated as region-unspecified and retained in the US-scoped payload.

Backblaze documents CA East as its Canada East region in Toronto, Ontario. The region policy now recognizes the bounded forms `CA East`, `CA East Region`, and `CA East Core Services` as non-US vendor regions. It deliberately does not classify arbitrary `CA` text as Canada, because `CA` is also the US postal abbreviation for California.

### 3. FireHydrant can move active maintenance into the incidents array

PR #143 passed deterministic tests, TypeScript, application build, dependency audit, and CodeQL. Its first production release, run `31637357593`, also passed the full Pages build/deploy, modern Chrome, pinned legacy Chromium, and 458x291 Yodeck checks.

The release artifact was then inspected directly instead of relying on those green structural gates. The fresh production payload proved the CA East scope fix worked: the old CA East incident and maintenance records were emitted as resolved/ended changes, and only US components remained in Backblaze component status.

However, the same live payload exposed another vendor-shape behavior. Backblaze FireHydrant had moved `US East Core Services Maintenance - 8/12/2026` into its raw `incidents` array after the maintenance window began. The adapter treated unresolved FireHydrant array membership as sufficient incident evidence, even though:

- the title explicitly said maintenance;
- the component condition was maintenance, not a problem state;
- there was no independent customer-impact statement;
- the public Backblaze page still reported all systems operational.

That caused the first production payload after PR #143 to publish Backblaze as `degraded`, `attention=action`, with one active incident. Release `31637357593` is therefore rejected as final evidence for this stream even though its deployment and rendering jobs were green.

The follow-up adapter rule is semantic rather than array-based:

- a FireHydrant record whose title/status identifies maintenance is not an incident when its components are neutral and its notes/timeline contain no explicit service-impact evidence;
- a maintenance-related record still becomes an incident when the vendor reports actual customer impact or a component enters a real problem state;
- ordinary future US maintenance may remain maintenance context;
- CA East remains excluded from US scope.

## Permanent product invariants

1. Scheduled or in-progress maintenance is context, never an alert or operator action by itself.
2. Maintenance can become an incident only when the vendor reports active customer service impact and the incident-classification path independently accepts that impact.
3. Vendor API array placement is not itself sufficient to override maintenance semantics.
4. Maintenance remains available in dedicated maintenance/context surfaces and counts.
5. Backblaze CA East maintenance is excluded from the US scope.
6. Backblaze US East and US West maintenance may remain as US maintenance context but still cannot enter the action queue without independent incident evidence.
7. Backblaze operational service state must remain operational when only maintenance exists.
8. Wallboard Priority Signals and provider alert rotation remain incident-only.

## Regression coverage

- `src/__tests__/maintenanceAlertBoundary.test.ts` constructs an operational Backblaze provider with an in-progress US maintenance window and requires maintenance retention, zero affected providers, and zero maintenance action items.
- `scripts/__tests__/backblaze-maintenance-scope.test.js` requires the exact reported CA East maintenance title to be non-US, requires US East to remain US-relevant, and verifies a healthy Backblaze FireHydrant payload drops CA East maintenance and CA East components from the US-scoped model.
- `scripts/__tests__/backblaze-maintenance-incident-boundary.test.js` reproduces FireHydrant placing same-day US East maintenance in the `incidents` array and requires the adapter to remain healthy. A companion test requires the same maintenance-related title to remain an incident when explicit degraded customer impact and a degraded component are present.
- Existing Backblaze adapter coverage that preserves US West scheduled maintenance remains in place, proving the fix is semantic classification and scope correction rather than global maintenance deletion.

## PR #143 verification

Final PR #143 head: `09958617702e572ca71f9b77acf82d5f6bebb136`.

- pull-request checks: `31637236607`, success;
- deterministic tests: success;
- TypeScript: success;
- real application build: success;
- dependency audit: success;
- CodeQL: `31637236520`, success;
- merge SHA: `728a9ae9f7d38ab86a4f7e7f262feecd0be35dcd`.

## Rejected production evidence after PR #143

Production release `31637357593` on merge `728a9ae9f7d38ab86a4f7e7f262feecd0be35dcd` completed build and deploy successfully. The release collected fresh vendor data, passed payload compatibility and truth/freshness gates, deployed Pages, passed current Chrome, pinned legacy Chromium, and the exact 458x291 Yodeck verifier.

The retained Pages artifact `9157494035` was inspected directly. It showed:

- Backblaze service state: `degraded`;
- Backblaze attention: `action`;
- Backblaze active incident count: 1;
- active incident: `US East Core Services Maintenance - 8/12/2026`;
- active incident component: `US East Region`;
- retained US maintenance context: `US West Core Services Maintenance`, scheduled for 2026-08-19;
- CA East component absent from current component status;
- change history resolving/ending the old `CA East Core Services Maintenance - 8/12/2026` record.

This direct payload inspection overruled the green deployment checks and triggered the FireHydrant semantic follow-up.

## PR #144 verification

Final PR #144 head: `cb23b6d0fb3219e47275bb7d1e93dc1dd6935703`.

- pull-request checks: `31638247490`, success;
- deterministic tests, including both maintenance-only and explicit-impact FireHydrant fixtures: success;
- TypeScript: success;
- real application build: success;
- dependency audit: success;
- CodeQL: `31638247464`, success;
- merge SHA: `e082ff8efe9e391683d375a2d88e8ab860fd973c`.

## Accepted production evidence

Production release `31638367724` on `e082ff8efe9e391683d375a2d88e8ab860fd973c` completed successfully.

The release passed:

- repository provider validation, quality, deterministic tests, TypeScript, and dependency audit;
- fresh public vendor collection without GitHub credentials;
- browser payload compatibility;
- truth, coverage, and freshness verification;
- real application build and Pages deployment;
- deployed asset and payload smoke checks;
- current Chrome rendering;
- pinned pre-cascade-layer Chromium runtime;
- exact 458x291 Yodeck wallboard verification.

Post-merge CodeQL run `31638367825` succeeded.

The accepted Pages artifact is `9157865212`, digest `sha256:8137408d46ac132180b6f0dc746438370f66f3c453f02a577d1ed1fb16eacb33`.

Direct inspection of its freshly collected `status.json` proved:

- Backblaze status: `All systems operational. Nothing to report.`;
- `service_state=operational`;
- `source_state=available`;
- `source_health=healthy`;
- `attention=informational`;
- `truth_basis=confirmed-operational`;
- active Backblaze incident count: 0;
- problem Backblaze component count: 0;
- current components: US West Region operational, US East Region operational;
- current CA East records: 0;
- current `US East Core Services Maintenance - 8/12/2026` incident records: 0;
- retained Backblaze maintenance context: future `US West Core Services Maintenance`, scheduled for 2026-08-19;
- change history contains `incident_resolved` for the false US East maintenance alert and `service_recovered` for Backblaze.

The accepted Yodeck evidence artifact is `9157892822`, digest `sha256:1a0dc42a4f68ebd675b8b731485f3af91121c8cb4e02c1bcc7359146ac930bee`.

The retained 458x291 screenshot was reviewed directly. The active-provider rail and priority list contained Salesforce and Kaseya, with no Backblaze alert chip and no Backblaze priority row. This visually agrees with the corrected production payload.

The downstream Premium product experience verification run `31638495173` also succeeded across browser live truth, premium operator experience, Product Depth, Microsoft 365, and provider identity/NUSO. Its evidence artifact is `9157919013`, digest `sha256:9368a18fb153723fdebf33c951aad04968b57538cbe65fbebe1b7f5b08e38741`.

## Closure

This stream is closed because the accepted production payload and rendered wallboard now enforce the intended distinction:

- incidents are alerts;
- maintenance is context;
- maintenance becomes an alert only when separate current vendor evidence demonstrates actual service impact.

Future changes to FireHydrant parsing, maintenance modeling, region scope, the operator action queue, or wallboard priority composition must preserve these invariants and retain direct production evidence when the behavior changes.