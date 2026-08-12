# Maintenance is context, not an alert

Date: 2026-08-12
Status: implementation in progress
Baseline main: `9488cf75741339a3b646098c0effc0109a1170b0`
Branch: `agent/maintenance-is-context-not-alert-2026-08-12`

## Reported production defect

Backblaze appeared with `CA East Core Services Maintenance - 8/12/2026` in a priority-oriented product surface even though scheduled maintenance is not an active service incident.

Two independent defects were present.

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

## Required invariants

1. Scheduled or in-progress maintenance is context, never an alert or operator action by itself.
2. Maintenance can become an incident only when the vendor reports active customer service impact and the incident-classification path independently accepts that impact.
3. Maintenance remains available in dedicated maintenance/context surfaces and counts.
4. Backblaze CA East maintenance is excluded from the US scope.
5. Backblaze US East and US West maintenance may remain as US maintenance context but still cannot enter the action queue.
6. Backblaze operational service state must remain operational when only scheduled maintenance exists.
7. Wallboard Priority Signals and provider alert rotation remain incident-only.

## Regression coverage

- `src/__tests__/maintenanceAlertBoundary.test.ts` constructs an operational Backblaze provider with an in-progress US maintenance window and requires maintenance retention, zero affected providers, and zero maintenance action items.
- `scripts/__tests__/backblaze-maintenance-scope.test.js` requires the exact reported CA East maintenance title to be non-US, requires US East to remain US-relevant, and verifies a healthy Backblaze FireHydrant payload drops CA East maintenance and CA East components from the US-scoped model.
- Existing Backblaze adapter coverage that preserves US West scheduled maintenance remains in place, proving the fix is a scope correction rather than global maintenance deletion.

## Completion requirement

Do not close this record until pull-request tests, TypeScript, application build, audit, and CodeQL pass, the fix is merged, the main production release succeeds, and production evidence confirms Backblaze is not presented as an alert because of the reported CA East maintenance record.

Append the PR number, final head, merge SHA, CI runs, production release, post-merge verification, and observed production Backblaze state before closure.
