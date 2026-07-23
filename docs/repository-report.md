# Repository architecture report

## Product and trust model

This repository builds a static MSP operations heads-up console from 90 official provider sources. Schema v2 separates service health (`operational`, `degraded`, `major`, `unknown`) from source health (`available`, `limited`, `unavailable`, `disabled`, `pending`, `stale`). Explicit provider fields drive summaries, filters, attention, and colors; prose never drives state. Complete generator and browser validation reconciles provider/incident counts, references, identities, URLs, timestamps, booleans, priorities, and allowed enums, preventing false-green output.

Retrieval is bounded by concurrency, timeout, streaming byte limits, parser-specific content types, and one transient retry. Parser/schema/size/content-type failures are not retried and never become incidents. Future, resolved, maintenance, noisy, old, and duplicate incidents are excluded. Writes are atomic and generated files are ignored.

## MSP capabilities

The briefing orders major incidents, degradation, changes, source gaps, unknown/limited providers, then operational confirmations. Attention is independently classified as critical/action/watch/informational. Validated optional catalog metadata supplies targeted impact and technician action. Operator mode includes broad search/filtering, disclosures, attempt diagnostics, bounded change history, official links, and cautious local communication drafts. Persistent wallboard mode displays the high-attention/changed subset with larger, reduced-detail cards.

A prior deployed snapshot is optional, validated, and compared during deployment. It detects incident creation, severity movement and resolution plus service/source transitions. Missing history is safe and an initial run is not reported as mass change.

## Automation and security

- `test.yml`: Node 22, `npm ci`, catalog validation, 35+ deterministic tests, strict typecheck, and Vite-only build; no vendor access.
- `refresh-pages.yml`: sole Pages workflow and concurrency group. A `contents: read` build job optionally retrieves history, runs checks, performs one official-source generation and one app build, then uploads one artifact. A dependent deploy job alone receives Pages/OIDC write permissions and deploys once.
- Browser traffic is limited to static assets and deployed `status.json`. There is no backend, database, credential, analytics, or unofficial source.

The `/sst/` Vite base, copied `status.json`, logo assets, stale-data lifecycle, visibility-aware refresh wording, safe links, focus indicators, semantic landmarks, live announcements, reduced-motion behavior, and 320px responsive layout support GitHub Pages operations and accessibility. Microsoft tenant health remains intentionally limited because reliable detail requires authenticated Graph access.
