# Maintenance history

Material autonomous maintenance is recorded here in reverse chronological order.

## 2026-08-20 - Restore Shopify current incident parsing

- Trigger: Scheduled health verification found the latest deployed payload at 79/80 live official sources with Shopify as the sole blind source.
- Verified root cause: Shopify's official page exposed a named unresolved incident and current update details, but the generic HTML path recognized only an unspecified issue state because no Shopify current-incident adapter existed.
- Corrective action: Added bounded extraction of the official current incident link, vendor title, update state, and update detail. Missing or unreadable current detail remains limited and fail-closed.
- Affected subsystem: Public status collection and Shopify HTML parsing.
- Version: 3.3.1 to 3.3.2.
- Regression protection: Added deterministic incident, provenance, severity, and legend-only false-positive tests.
- CI and security validation: Pull-request provider validation, quality gates, deterministic tests, TypeScript checking, application build, complete dependency audit, and CodeQL passed on the exact final head before merge.
- Production verification method: The merged release must pass collection, Status Contract v3, Pages deployment, production smoke, current and pinned legacy Chromium, exact 458x291 Yodeck verification, and publish successful live-source coverage.
- Relevant pull request: #159.
- Remaining risk: A future incompatible Shopify markup change will fail closed rather than fabricate service health.
