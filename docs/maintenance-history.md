# Maintenance history

Material autonomous maintenance is recorded here in reverse chronological order.

## 2026-08-20 - Use Shopify's structured status API

- Trigger: Releases #1361 through #1364 showed that Shopify's presentation HTML remained limited despite increasingly permissive timestamp-shape support.
- Verified root cause: Production collection depended on presentation markup even though Shopify officially documents a first-party Statuspage v2 summary endpoint containing current status, components, unresolved incidents, and ISO timestamps.
- Corrective action: Routed Shopify through the existing structured Statuspage JSON adapter at `/api/v2/summary.json`; retained the HTML parser only as fail-closed regression coverage.
- Affected subsystem: Public status collection and Shopify source routing.
- Version: 3.3.5 to 3.3.6.
- Regression protection: Added a production-source contract requiring Shopify's official structured endpoint and page URL.
- CI and security validation: Pull-request provider validation, quality gates, deterministic tests, TypeScript checking, application build, complete dependency audit, and CodeQL must pass on the exact final head before merge.
- Production verification method: The merged release must publish 80/80 live official sources and pass Pages, production smoke, current and pinned legacy Chromium, and exact 458x291 Yodeck verification.
- Remaining risk: Shopify API availability remains an external dependency and will fail closed on future transport or contract failure.

## 2026-08-20 - Normalize Shopify split timestamps

- Trigger: Post-merge release #1363 still published Shopify as limited because its visible Statuspage date markup produced spaces around comma and colon punctuation.
- Verified root cause: The strict timestamp expression accepted plain text but not the rendered split-node form, such as `Aug 19 , 2026 - 19 : 54 EDT`.
- Corrective action: Accepted bounded whitespace around Shopify date/time punctuation and normalized the vendor time before incident identity and freshness validation.
- Affected subsystem: Public status collection, incident freshness, and Shopify HTML parsing.
- Version: 3.3.4 to 3.3.5.
- Regression protection: Updated the production-shape fixture to split date and time fields across markup while asserting the canonical vendor time.
- CI and security validation: Pull-request provider validation, quality gates, deterministic tests, TypeScript checking, application build, complete dependency audit, and CodeQL must pass on the exact final head before merge.
- Production verification method: The merged release must publish 80/80 live official sources and pass Pages, production smoke, current and pinned legacy Chromium, and exact 458x291 Yodeck verification.
- Remaining risk: A non-textual or locale-changed Shopify timestamp will remain limited until explicitly supported.

## 2026-08-20 - Preserve Shopify current-evidence time

- Trigger: Post-merge release #1361 parsed Shopify's incident title but still published 79/80 live coverage and kept Shopify blind.
- Verified root cause: The source-freshness contract rejects current-page incidents without vendor time; the Shopify adapter extracted title, state, and detail but omitted the visible vendor update timestamp.
- Corrective action: Extract and preserve Shopify's official update time as current-page evidence, and return limited when a current incident has no readable vendor timestamp.
- Affected subsystem: Public status collection, incident freshness, and Shopify HTML parsing.
- Version: 3.3.3 to 3.3.4.
- Regression protection: Added exact timestamp assertions for Identified and Monitoring states plus an untimestamped fail-closed case.
- CI and security validation: Pull-request provider validation, quality gates, deterministic tests, TypeScript checking, application build, complete dependency audit, and CodeQL passed on the exact final head before merge.
- Production verification method: The merged release must publish 80/80 live official sources and pass Pages, production smoke, current and pinned legacy Chromium, and exact 458x291 Yodeck verification.
- Relevant pull request: #161.
- Remaining risk: Shopify timestamp formatting changes will remain limited until explicitly supported.

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
