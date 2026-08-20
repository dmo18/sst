# Maintenance history

Material autonomous maintenance is recorded here in reverse chronological order.

## 2026-08-20 - Correct Shopify hidden-template ordering

- Trigger: Post-merge release #1360 passed collection gates but remained at 79/80 live official sources, proving the 3.3.2 Shopify repair did not match production markup.
- Verified root cause: Shopify's raw page includes hidden subscription-template text before visible incident content; the 3.3.2 parser truncated at that first marker before reaching the current incident.
- Corrective action: Bound parsing from the current incident title to the following subscription or unresolved-incident boundary, and added an explicit unresolved-current-incident title fallback.
- Affected subsystem: Public status collection and Shopify HTML parsing.
- Version: 3.3.2 to 3.3.3.
- Regression protection: Added deterministic coverage with hidden subscription text before the visible incident and without relying on incident-link markup.
- CI and security validation: Pull-request provider validation, quality gates, deterministic tests, TypeScript checking, application build, complete dependency audit, and CodeQL passed on the exact final head before merge.
- Production verification method: The merged release must publish 80/80 live official sources and pass Pages, production smoke, current and pinned legacy Chromium, and exact 458x291 Yodeck verification.
- Relevant pull request: #160.
- Remaining risk: A future Shopify page that removes both current incident links and the explicit unresolved-incident label will remain limited and fail closed.

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
