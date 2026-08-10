# Full architecture reconciliation

Status: implementation complete, production verification pending
Started: 2026-08-10
Base commit: `82bc6cf3df4a65d2dc3adb43885b04f5aafcd2ee`
Pull request: #111

The previous four-phase tracker was closed against a reduced implementation scope. This document is the authoritative reconciliation of the original review backlog and the approved next-level architecture plan. The implementation is complete on PR #111, but the overhaul is not considered closed again until the merged commit passes both the full production release path and an actual scheduled refresh that reuses the verified application shell.

## Original review findings

| # | Requirement | Reconciled state |
|---|---|---|
| 1 | Preserve untimed current-page incidents through wallboard alert filtering | Complete |
| 2 | Include `observed_at` and `evidence_basis` in the browser contract | Complete |
| 3 | Remove duplicate browser-check telemetry ownership | Complete |
| 4 | Centralize component health classification | Complete |
| 5 | Enforce canonical provider catalog parity in browser validation | Complete |
| 6 | Revalidate canonical provider overrides after merge | Complete |
| 7 | Enforce freshness for `observed_at` evidence | Complete |
| 8 | Strengthen fallback incident identity | Complete |
| 9 | Separate request latency from collection elapsed time | Complete |
| 10 | Remove unsafe sandbox bypass for untrusted vendor rendering | Complete |
| 11 | Bound browser `status.json` retrieval | Complete |
| 12 | Recover overdue polling on visibility resume | Complete |
| 13 | Make browser storage access resilient | Complete |
| 14 | Reduce `update-status` monolith ownership and establish a formal adapter boundary | Complete |
| 15 | Remove RingCentral-specific post-processing | Complete |
| 16 | Consolidate release validation invariants | Complete |
| 17 | Harden supply chain: immutable actions, dependency audit, Dependabot, CodeQL | Complete |
| 18 | Add lint, formatting, and hook-quality gates | Complete |
| 19 | Remove duplicated cross-layer policy helpers | Complete |
| 20 | Remove hardcoded provider-count assumptions | Complete |

## Approved next-level architecture

| Requirement | Reconciled state |
|---|---|
| Explicit Status Contract v3 metadata and shared schema/type policy | Complete |
| Canonical incident temporal model | Complete |
| Source adapter SDK / normalized producer boundary | Complete |
| Extract `usePayloadPoller` from `App.tsx` | Complete |
| Canonical provider catalog hash in payload and release validation | Complete |
| Historical source reliability for both 7-day and 30-day reporting | Complete |
| Parser canary plus bounded quarantine semantics | Complete |
| Conservative active-event correlation | Complete |
| CSP and browser security policy | Complete |
| Automated pinned legacy-signage compatibility runtime test | Complete |
| Scheduled release pipeline optimization / immutable app build reuse | Complete |
| Keep customer, tenant, ticket, device, and user data out of public Pages | Complete |

## R1 - Contract and collector architecture

- Public payloads are emitted as Status Contract v3 with `schema_version: 3`, `contract_version: 3`, and a deterministic canonical provider `catalog_hash`.
- `src/wirePayloadValidation.ts` owns public-envelope validation. The collector may still validate an internal schema-2 draft before the final envelope is emitted, which avoids breaking internal construction stages while preventing schema-2 data from reaching the browser or release gate.
- The prior deployed schema-3 payload is accepted only at the narrow `scripts/update-status.mjs` compatibility boundary so rolling reliability history survives subsequent refreshes. Production parser ownership remains outside that shim.
- `src/providerCatalog.ts` derives the canonical active catalog and its stable FNV-1a identity. Browser validation, release verification, and production smoke require the same hash.
- Provider validation derives active counts from the raw catalog and exclusion set instead of literal raw/active count constants.
- `scripts/source-adapter-sdk.mjs` defines adapter registration, result-kind validation, current-page provenance defaults, and stable fallback incident identity. `scripts/public-source-repairs.mjs` is the registry-backed facade; the provider-specific implementation is isolated behind `scripts/public-source-adapter-implementation.mjs`.
- SDK fallback IDs include provider identity, semantic incident text, source, affected service, and available first detection. This prevents equivalent titles from different providers from colliding.
- Source reliability now publishes simultaneous bounded seven-day and thirty-day windows, each independently reconciled from UTC daily buckets.
- Schema canaries now include a bounded quarantine state machine: `clear`, `observing`, and `quarantined`. A first shape change enters observing; repeated shape churn can quarantine; stable accepted observations clear the quarantine. Quarantine changes source trust only and never creates, suppresses, or changes vendor `service_state`.
- The source-quality gate enforces one canonical exported definition of incident effective-time policy, component disposition, and region scope.

## R2 - Browser architecture and security

- `src/usePayloadPoller.ts` owns browser payload retrieval, request ownership, size limits, Status Contract v3/hash validation, freshness checks, cadence, visibility-resume recovery, and the timestamp of the most recent successful browser check.
- `App.tsx` is again a composition layer. It selects the 60-second operator cadence or URL-controlled wallboard cadence and consumes the poller hook.
- The production HTML now declares a restrictive CSP for locally bundled scripts, same-origin data retrieval, local/data images and fonts, no objects, no forms, and a self-only base URI. Inline script execution is not allowed. Inline styles remain permitted because the React application uses style attributes.
- The application build target is Chrome 98, and non-scheduled production releases download a pinned pre-cascade-layer Chromium snapshot and execute the real 458 by 291 wallboard. The probe requires the `no-css-layers` compatibility marker and rendered operational content.
- The old Chromium compatibility probe uses `--no-sandbox` only while rendering this repository's already-deployed static application. Untrusted vendor-page collection remains separately sandboxed with disposable browser profiles and no GitHub credentials.

## R3 - Engineering and supply-chain gates

- GitHub Actions references are immutable full SHAs and use current action generations: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5, and upload-artifact v7.
- CodeQL v4 analyzes JavaScript/TypeScript on pull requests, `main`, and a weekly schedule with read-only contents plus security-event write permission.
- Pull-request and full production code-change gates run provider validation, dependency-free source-quality checks, formatting hygiene, the complete deterministic suite, TypeScript, production build, and a complete high-severity dependency audit.
- `npm run quality` owns lint and formatting hygiene without increasing the dependency graph. The quality gate also prevents polling concerns from leaking back into `App.tsx` and prevents duplicate canonical policy definitions.
- `.githooks/pre-commit` runs the same quality gate. `npm run hooks:install` explicitly configures `core.hooksPath=.githooks`; repository setup does not silently mutate a developer's Git config during `npm ci`.
- Dependabot continues to own weekly npm and GitHub Actions update proposals.

## R4 - Scheduled release optimization

- Push and manual releases run the complete verification path, build the static application, remove mutable status/deployment files from that shell, and publish a commit-keyed `verified-app-shell-${GITHUB_SHA}` artifact.
- Scheduled refreshes still install dependencies, validate the catalog, collect all first-party vendor data without GitHub tokens, emit Status Contract v3, run browser/release validation, deploy Pages, smoke test production, render the live application, verify exact Yodeck geometry, and publish live-coverage status.
- Scheduled refreshes do not rerun unchanged source-quality, deterministic, TypeScript, dependency-audit, or application-compilation work when the verified shell for the same commit is available.
- If the shell artifact is missing or expired, the scheduled workflow performs a fail-safe application build rather than blocking freshness.
- Pages releases remain serialized with `cancel-in-progress: false`.

## Pull-request evidence

Implementation head validation on 2026-08-10 established the clean pre-production baseline:

- canonical raw/post-consolidation provider validation passed;
- dependency-free quality gates passed;
- all 284 deterministic tests passed in the normal repository test command;
- TypeScript checking passed;
- the Chrome-98-targeted production application build passed;
- complete high-severity dependency audit passed;
- CodeQL was enabled and analyzed the reconciliation branch using the pinned v4 action.

During integration, temporary file-level and captured-log diagnostics were used only to locate stale architecture-location assertions after the adapter and poller extractions. Those diagnostics are removed before the final PR head. No assertion was skipped or weakened to obtain the green test result.

## Production completion rule

This reconciliation closes only after all of the following are true on the final merged `main` commit:

1. canonical provider validation, quality gates, all deterministic tests, TypeScript, complete dependency audit, and CodeQL pass;
2. token-free sandboxed first-party collection produces a valid Status Contract v3 payload bound to the canonical catalog hash;
3. seven-day and thirty-day reliability plus canary/quarantine metadata pass the shared server/browser contract;
4. the reusable release contract and deployed production smoke pass;
5. Pages deployment identity matches the merged commit and workflow run;
6. normal current Chromium renders the operator application successfully;
7. pinned pre-cascade-layer Chromium renders the 458 by 291 compatibility wallboard and activates the no-CSS-layers path;
8. the exact current-Chromium 458 by 291 Yodeck verifier passes and its artifacts upload;
9. a subsequent scheduled refresh on the same commit restores the verified app-shell artifact, skips unchanged code verification/build work, and still passes live collection, validation, deployment, smoke, rendering, Yodeck verification, and status publication.

After those gates are proven, this document is updated with the final merge commit and workflow run evidence and becomes the authoritative completed architecture record.