# Contributing

Use Node 22 or newer. Keep changes focused and preserve the static, first-party-only, fail-closed architecture.

## Prohibited changes

Do not add:

- credentials, tokens, or secrets;
- a server runtime or database;
- paid or authenticated APIs;
- browser-side vendor collection;
- customer, tenant, ticket, device, or user-specific data to the public Pages application;
- commercial status aggregators;
- crowdsourced outage truth;
- synthetic probes as vendor-health evidence;
- generated `public/status.json` files;
- unsafe HTML or unreviewed external scripts;
- competing wallboard DOM controllers;
- separate Pages unlock or recovery workflows.

## Provider and collector changes

Provider counts are derived from the raw catalog and consolidation rules. Do not introduce literal expected raw/active counts into validation. When adding, removing, excluding, or consolidating a provider, explain the intended catalog change and run canonical provider validation.

Current-page provider conclusions must pass through the source-adapter registry/SDK boundary. Do not bypass stable fallback identity or current-page provenance normalization with provider-specific postprocessing.

Collector failures, parser failures, schema drift, parser quarantine, unsupported content types, login pages, and bot challenges must fail closed. They must not become vendor incidents or operational confirmations.

Status Contract v3 is the public wire contract. Any payload-contract change must preserve or deliberately migrate:

- explicit schema and contract versioning;
- canonical provider catalog hash validation;
- shared server/browser validation;
- incident temporal evidence rules;
- source reliability and canary/quarantine reconciliation.

Parser quarantine is a source-trust control only. It may reduce source quality or source health, but it must not create, suppress, resolve, or change a vendor `service_state` conclusion.

## Browser changes

Keep browser payload retrieval inside `src/usePayloadPoller.ts`. `App.tsx` should remain a composition/cadence-selection layer rather than reacquiring fetch ownership, payload-size policy, wire validation, request ownership, or visibility recovery.

Preserve the production CSP. New runtime dependencies, browser connections, inline scripts, worker behavior, external assets, or form behavior require an explicit CSP review and production-smoke coverage.

## Wallboard changes

Wallboard work must preserve:

- newest-first incident ordering;
- provider icons and names;
- exclusion of routine maintenance and collector failures;
- shared `alerts` filtering for incidents and provider chips;
- continuous vertical incident looping only when needed;
- continuous horizontal provider looping only when needed;
- inline payload and browser-age telemetry;
- auto, pinned-open, and pinned-closed header modes;
- a readable unattended layout at exactly 458 by 291 pixels.

React must own incident selection and ordering. Do not mutate rendered signal rows from a global script.

Any wallboard behavior change should add or update deterministic contract coverage. Visual/runtime changes should also preserve the pinned pre-cascade-layer Chromium compatibility probe and the exact 458 by 291 current-Chromium production verifier.

## Local quality hook

The repository includes an opt-in pre-commit quality hook. Configure it once after cloning with:

```bash
npm run hooks:install
```

This sets `core.hooksPath=.githooks`. The hook runs `npm run quality`. Hook installation is intentionally explicit; `npm ci` must not mutate contributor Git configuration.

## Required validation

Before submitting a runtime change, run:

```bash
npm ci
npm run validate-providers
npm run quality
npm test
npm run typecheck
npm run build:app
npm audit --audit-level=high
```

Use `npm run update-status` when validating live production feeds. Deterministic tests must not contact vendors.

## Deployment changes

Treat GitHub Pages as a separate release stage.

- Keep one Pages workflow.
- Keep one Pages concurrency group with `cancel-in-progress: false`.
- Keep collection/build permissions read-only except for reading repository workflow artifacts when reusing the verified application shell.
- Restrict Pages, OIDC, and commit-status write permissions to the deploy job.
- Keep live vendor collection token-free.
- Do not use repeated commits as deployment retries.
- Do not set `actions/deploy-pages` timeouts above 600000 milliseconds.
- Do not mark a release successful before production smoke and browser checks pass.
- Code-changing releases must publish a verified application-shell artifact keyed by commit.
- Scheduled refreshes should reuse that shell and may skip unchanged quality/test/type/audit/compile work only when the exact commit-keyed artifact is present. The live data collection, wire/release validation, Pages deployment, production smoke, current-browser render, exact Yodeck verifier, and status publication remain mandatory.
- If the verified shell is unavailable, prefer a fail-safe application build over skipping a data refresh.

All third-party GitHub Actions references must remain immutable full commit SHAs. Human-readable version comments should identify the intended release. CodeQL and complete dependency auditing are required security gates.

## Documentation

Update the complete relevant document, not only an isolated fragment:

- `README.md` for current product behavior.
- `docs/architecture-reconciliation.md` for final overhaul architecture and production evidence.
- `docs/operations-intelligence.md` for source SLO, canary/quarantine, and correlation semantics.
- `docs/repository-report.md` for broader architecture.
- `docs/wallboard-url-options.md` for wallboard configuration.
- `docs/system-status.md` for current operational state.
- `CLAUDE.md` for coding-agent rules.
- `CHANGELOG.md` when a version is released.

Historical release-scope and superseded architecture documents should remain historical unless a factual correction is required.
