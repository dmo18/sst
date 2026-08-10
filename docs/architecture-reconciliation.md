# Full architecture reconciliation

Status: reopened
Started: 2026-08-10
Base commit: `82bc6cf3df4a65d2dc3adb43885b04f5aafcd2ee`

The previous four-phase tracker was closed against a reduced implementation scope. This document reconciles the original review backlog and the approved next-level architecture plan against the deployed `main` branch. The overhaul is not considered complete again until every missing or partial item below is either implemented and production-verified or explicitly rejected with a documented technical reason.

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
| 14 | Reduce `update-status` monolith ownership | Partial - production uses extracted core, but legacy parser architecture still needs a formal adapter boundary |
| 15 | Remove RingCentral-specific post-processing | Complete |
| 16 | Consolidate release validation invariants | Complete |
| 17 | Harden supply chain: immutable actions, dependency audit, Dependabot, CodeQL | Partial - CodeQL is missing and pinned action majors still target deprecated Node 20 runtimes |
| 18 | Add lint, formatting, and hook-quality gates | Missing |
| 19 | Remove duplicated cross-layer policy helpers | Partial - temporal/component/region policies were consolidated, but a final duplication gate is still missing |
| 20 | Remove hardcoded provider-count assumptions | Missing - raw and active counts remain literal constants in `validate-providers.mjs` |

## Approved next-level architecture

| Requirement | Reconciled state |
|---|---|
| Explicit Status Contract v3 metadata and shared schema/type policy | Partial - shared TypeScript policy exists, but payload still declares `schema_version: 2` and has no explicit contract metadata |
| Canonical incident temporal model | Complete |
| Source adapter SDK / normalized producer boundary | Missing |
| Extract `usePayloadPoller` from `App.tsx` | Missing |
| Canonical provider catalog hash in payload and release validation | Missing |
| Historical source reliability for both 7-day and 30-day reporting | Partial - only a seven-day rollup exists |
| Parser canary plus bounded quarantine semantics | Partial - canary exists, quarantine policy does not |
| Conservative active-event correlation | Complete |
| CSP and browser security policy | Missing |
| Automated legacy-signage compatibility runtime test | Partial - static compatibility contracts exist, but no automated runtime fallback probe exists |
| Scheduled release pipeline optimization / immutable app build reuse | Missing - scheduled refreshes rerun deterministic tests, TypeScript, audit, and application compilation five times per hour |
| Keep customer, tenant, ticket, device, and user data out of public Pages | Complete and documented |

## Reconciliation implementation plan

### R1 - Contract and collector architecture

- Introduce explicit Status Contract v3 metadata while retaining a compatibility `schema_version` only if required by existing consumers.
- Add a deterministic catalog hash derived from the canonical active provider catalog and require it in server validation, browser validation, release validation, and production smoke.
- Remove literal provider-count expectations from catalog validation.
- Introduce a small source-adapter SDK that owns normalized result shapes, current-page provenance defaults, stable incident identity, and adapter registration/dispatch contracts.
- Add bounded parser-quarantine metadata that affects source trust only and can never fabricate service health.
- Extend source reliability to simultaneous seven-day and thirty-day windows.

### R2 - Browser architecture and security

- Extract payload retrieval, request ownership, cadence, visibility recovery, size limits, validation, and successful browser-check telemetry into `usePayloadPoller`.
- Add a restrictive CSP compatible with the static Vite application and same-origin `status.json` retrieval.
- Add an automated runtime compatibility probe for the legacy no-CSS-layers wallboard fallback.

### R3 - Engineering and supply-chain gates

- Upgrade pinned GitHub Actions to current immutable revisions that target supported runner runtimes.
- Add CodeQL for JavaScript/TypeScript.
- Add dependency-free repository lint/format/source-quality gates and a local pre-commit hook path so quality enforcement does not expand the runtime dependency graph.
- Add deterministic tests for action runtime generation, CSP, hook/quality wiring, catalog hash, adapter registration, quarantine isolation, and provider-count derivation.

### R4 - Pipeline optimization and final production proof

- Split immutable application verification from scheduled live-data refresh work so scheduled refreshes do not rerun unchanged deterministic tests, typecheck, audit, and application compilation.
- Preserve serialized Pages releases, token-free vendor collection, release-contract validation, production smoke, normal headless rendering, and exact 458 by 291 Yodeck verification.
- Merge only after PR checks are green, then require a full production release from the final merge commit.

## Completion rule

This reconciliation closes only when the final `main` commit has passed canonical provider validation, quality gates, deterministic tests, TypeScript, dependency audit, CodeQL configuration validation, live source collection, shared server/browser contract validation, release reconciliation, production deployment identity, normal rendering, the legacy compatibility runtime probe, and exact 458 by 291 Yodeck verification.