# Current system status

Status timestamp: 2026-08-10 20:10 Eastern Time

## Executive status

| Area | Status | Notes |
| --- | --- | --- |
| Full architecture reconciliation | Production code complete | PR #111 merged the complete original-review and next-level backlog at `4252a3009dd3fe150612269b511f5b1ecc38f516`. |
| Legacy Chromium release repair | Production verified | PR #112 merged at `d61b177dbe89c4e393992524df98c073add0d7bf`; production run #790 passed the published old-Chromium resolver and runtime probe. |
| Status Contract | Healthy | Public payloads use schema/contract v3 and are bound to the canonical active provider catalog hash. |
| Active catalog | Healthy | 80 raw entries consolidate to 79 active providers; validation derives counts instead of hardcoding them. |
| Browser polling | Healthy | `usePayloadPoller` owns retrieval, size bounds, v3/hash validation, request ownership, freshness, cadence, visibility recovery, and successful-check telemetry. |
| Operator cadence | Healthy | 60-second browser retrieval cadence. |
| Wallboard cadence | Healthy | Three-minute default with bounded 15-second through one-hour `refresh=` override. |
| Source reliability | Healthy | Every provider carries bounded seven-day and thirty-day observation windows. |
| Parser trust | Healthy | Canary/quarantine state is validated; observing/quarantined parsers reduce source trust without changing vendor service state. |
| Supply chain | Healthy | Current immutable action generations, CodeQL v4, complete dependency audit, Dependabot, repository quality gates, and opt-in pre-commit hook are present. |
| Public browser security | Healthy | Restrictive CSP, local application assets, and same-origin status retrieval. |
| Vendor rendering trust boundary | Healthy | Untrusted vendor pages use sandboxed Chromium, disposable profiles, and token-free collection. |
| Current-browser production render | Healthy | Run #790 passed deployed operator rendering. |
| Legacy-browser production render | Healthy | Run #790 resolved a published Chromium snapshot at or below the Chrome 98 branch-base ceiling and passed the 458 by 291 fallback runtime probe. |
| Exact Yodeck verification | Healthy | Run #790 passed the current-Chromium 458 by 291 geometry/filtering/marquee verifier and artifact upload. |
| Verified application shell | Published | Code-changing releases publish a commit-keyed immutable application-shell artifact for scheduled reuse. |
| Scheduled shell-reuse proof | Pending final closure gate | The next actual scheduled refresh on the same `d61b177d...` main commit must restore the verified shell, skip unchanged code verification/build work, and pass the complete live deployment path. |

## Current repository identity

- Repository: `dmo18/sst`
- Visibility: public
- Default branch: `main`
- Package: `msp-status-hud` 3.3.0
- Current production code commit: `d61b177dbe89c4e393992524df98c073add0d7bf`
- Full reconciliation implementation: PR #111
- Production legacy-browser repair: PR #112

## Current architecture

```text
provider catalog + consolidation
  -> canonical active catalog + stable hash
  -> bounded first-party collection
  -> structured adapters / current-page adapter registry
  -> fail-closed internal draft
  -> source, collection, 7d/30d reliability, and parser trust intelligence
  -> internal validation
  -> Status Contract v3 envelope
  -> public/status.json
  -> browser wire validation
  -> React operator app / wallboard
  -> serialized GitHub Pages release
```

Public service truth remains independent from collector trust. Source failures, SLO degradation, schema changes, parser observation, and parser quarantine do not fabricate outages or operational confirmations.

## Permanent code-change gates

The reconciled pull-request/release baseline requires:

- canonical provider validation;
- repository source-quality and formatting gates;
- complete deterministic test suite;
- TypeScript checking;
- Chrome-98-targeted production build;
- complete high-severity dependency audit;
- pinned CodeQL v4 JavaScript/TypeScript analysis;
- token-free live first-party collection;
- Status Contract v3/catalog-hash validation;
- release-contract reconciliation;
- Pages deployment and identity verification;
- deployed production smoke including CSP and wire identity;
- current-Chromium operator render;
- published pre-cascade-layer Chromium compatibility render;
- exact current-Chromium 458 by 291 Yodeck verification;
- verification artifact upload and live-coverage status publication.

PR #111's final implementation head passed 285 deterministic tests plus provider validation, repository quality, TypeScript, production build, dependency audit, and CodeQL before merge.

## Scheduled release contract

Scheduled status refreshes retain the live-data safety gates but reuse the exact commit-keyed application shell produced by a verified code-changing release. When that artifact is present the schedule skips unchanged source-quality, deterministic, TypeScript, dependency-audit, and application-compilation work. It still performs live collection, Status Contract v3/hash validation, release reconciliation, Pages deployment, production smoke, current-browser rendering, exact Yodeck verification, artifact upload, and status publication.

If the verified shell is unavailable, the schedule performs a fail-safe build rather than sacrificing data freshness.

The final architecture reconciliation remains open only for the real scheduled same-commit shell-reuse proof and the documentation closure release. See `docs/architecture-reconciliation.md`.