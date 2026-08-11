# Current system status

Status timestamp: 2026-08-10 21:05 Eastern Time

## Executive status

| Area | Status | Notes |
| --- | --- | --- |
| Full architecture reconciliation | Complete | PR #111 merged the complete original-review and next-level backlog; production run #790 and same-commit scheduled run #792 satisfy the final closure rule. |
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
| Current-browser production render | Healthy | Run #790 passed deployed operator rendering; scheduled run #792 passed the unchanged-shell current-browser path. |
| Legacy-browser production render | Healthy | Run #790 resolved a published Chromium snapshot at or below the Chrome 98 branch-base ceiling and passed the 458 by 291 fallback runtime probe. |
| Exact Yodeck verification | Healthy | Runs #790 and #792 passed the current-Chromium 458 by 291 geometry/filtering/marquee verifier and artifact upload. |
| Verified application shell | Proven | Code-changing run #790 published the commit-keyed application shell; scheduled run #792 restored it successfully. |
| Scheduled shell-reuse proof | Complete | Run #792 reused verified app shell artifact `9084789742`, skipped unchanged code verification/build work, and passed the complete scheduled live deployment path. |

## Current repository identity

- Repository: `dmo18/sst`
- Visibility: public
- Default branch: `main`
- Package: `msp-status-hud` 3.3.0
- Current production code commit: `d61b177dbe89c4e393992524df98c073add0d7bf`
- Full reconciliation implementation: PR #111
- Production legacy-browser repair: PR #112
- Full code-changing production proof: run #790 (`31444948649`)
- Same-commit scheduled shell-reuse proof: run #792 (`31446743500`)

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

PR #111's final implementation head passed 285 deterministic tests plus provider validation, repository quality, TypeScript, production build, dependency audit, and CodeQL before merge. Full production run #790 then passed the complete live code-changing release path on final commit `d61b177d...`.

## Scheduled release contract and proof

Scheduled status refreshes retain the live-data safety gates but reuse the exact commit-keyed application shell produced by a verified code-changing release. When that artifact is present the schedule skips unchanged source-quality, deterministic, TypeScript, dependency-audit, and application-compilation work. It still performs live collection, Status Contract v3/hash validation, release reconciliation, Pages deployment, production smoke, current-browser rendering, exact Yodeck verification, artifact upload, and status publication.

Run #792 proved this path on the exact same `d61b177d...` commit:

- quality, deterministic tests, TypeScript, dependency audit, application build, shell preparation, and shell publication were skipped;
- the verified shell lookup succeeded and logged reuse of artifact `9084789742`;
- shell restoration succeeded;
- the fail-safe application build was skipped;
- live collection reported 79/79 official sources, 100% coverage, quality 86/100, zero fallbacks, and zero blind providers;
- Status Contract v3 and release validation passed with catalog hash `fnv1a32:fa326cfc`;
- Pages deployment, production smoke, current-browser rendering, exact 458 by 291 Yodeck verification, artifact upload, and status publication all passed.

The legacy Chromium compatibility probe is intentionally limited to code-changing releases because scheduled runs reuse an already-verified immutable application shell. Run #790 remains the production proof for that browser path.

The full architecture reconciliation is closed. `docs/architecture-reconciliation.md` is the authoritative completion record.