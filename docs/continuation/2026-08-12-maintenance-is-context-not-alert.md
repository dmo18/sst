# Maintenance is context, not an alert

Date: 2026-08-12
Status: implementation in progress
Baseline main: `9488cf75741339a3b646098c0effc0109a1170b0`
Initial branch: `agent/maintenance-is-context-not-alert-2026-08-12`
Initial pull request: #143, `Keep maintenance context out of alerts`
Initial merge: `728a9ae9f7d38ab86a4f7e7f262feecd0be35dcd`
Follow-up branch: `fix/backblaze-maintenance-incident-promotion-2026-08-12`

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

PR #143 passed 357 deterministic tests, TypeScript, application build, dependency audit, and CodeQL. Its first production release, run `31637357593`, also passed the full Pages build/deploy, modern Chrome, pinned legacy Chromium, and 458x291 Yodeck checks.

The release artifact was then inspected directly instead of relying on those green structural gates. The fresh production payload proved the CA East scope fix worked: the old CA East incident and maintenance records were emitted as resolved/ended changes, and only US components remained in Backblaze component status.

However, the same live payload exposed another vendor-shape behavior. Backblaze FireHydrant had moved `US East Core Services Maintenance - 8/12/2026` into its raw `incidents` array after the maintenance window began. The adapter treated unresolved FireHydrant array membership as sufficient incident evidence, even though:

- the title explicitly said maintenance;
- the component condition was maintenance, not a problem state;
- there was no independent customer-impact statement;
- the public Backblaze page still reported all systems operational.

That caused the first production payload after PR #143 to publish Backblaze as `degraded`, `attention=action`, with one active incident. Release `31637357593` is therefore not accepted as final evidence for this stream even though its deployment and rendering jobs were green.

The follow-up adapter rule is semantic rather than array-based:

- a FireHydrant record whose title/status identifies maintenance is not an incident when its components are neutral and its notes/timeline contain no explicit service-impact evidence;
- a maintenance-related record still becomes an incident when the vendor reports actual customer impact or a component enters a real problem state;
- ordinary future US maintenance may remain maintenance context;
- CA East remains excluded from US scope.

## Required invariants

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
- deterministic tests: 357 passed, 0 failed;
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

## Completion requirement

Do not close this record until the follow-up pull-request tests, TypeScript, application build, audit, and CodeQL pass, the fix is merged, a new main production release succeeds, and the new production payload proves all of the following:

1. Backblaze is operational while its public page remains all-systems-operational;
2. neither CA East maintenance nor maintenance-only US East FireHydrant records are published as active incidents;
3. legitimate US maintenance context may remain in the maintenance collection;
4. Backblaze is absent from incident-only priority/alert surfaces unless separate service-impact evidence exists;
5. final production and repository evidence are appended here before closure.
