# Contributing

Use Node 22 or newer. Keep changes focused and preserve the static, first-party-only, fail-closed architecture.

## Prohibited changes

Do not add:

- credentials, tokens, or secrets;
- a server runtime or database;
- paid or authenticated APIs;
- browser-side vendor collection;
- commercial status aggregators;
- crowdsourced outage truth;
- synthetic probes as vendor-health evidence;
- generated `public/status.json` files;
- unsafe HTML or unreviewed external scripts;
- competing wallboard DOM controllers;
- separate Pages unlock or recovery workflows.

## Provider and collector changes

Provider changes must deliberately update or preserve the raw and active catalog counts. Explain limited sources and include deterministic parser fixtures whenever behavior changes.

Collector failures, parser failures, schema drift, unsupported content types, login pages, and bot challenges must fail closed. They must not become vendor incidents or operational confirmations.

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

Any wallboard behavior change should add or update deterministic contract coverage. Visual changes should also be checked at 458 by 291, 1920 by 1080, and one ultra-HD viewport.

## Required validation

Before submitting a runtime change, run:

```bash
npm ci
npm run validate-providers
npm test
npm run typecheck
npm run build:app
npm audit --audit-level=high
```

Use `npm run update-status` when validating live production feeds. Deterministic tests must not contact vendors.

## Deployment changes

Treat GitHub Pages as a separate release stage.

- Keep one Pages workflow.
- Keep one Pages concurrency group.
- Keep build permissions read-only.
- Restrict Pages and OIDC write permissions to the deploy job.
- Do not use repeated commits as deployment retries.
- Do not set `actions/deploy-pages` timeouts above 600000 milliseconds.
- Do not mark a release successful before production smoke and browser checks pass.

## Documentation

Update the complete relevant document, not only an isolated fragment:

- `README.md` for current product behavior.
- `docs/repository-report.md` for architecture.
- `docs/wallboard-url-options.md` for wallboard configuration.
- `docs/system-status.md` for current operational state.
- `CLAUDE.md` for coding-agent rules.
- `CHANGELOG.md` when a version is released.

Historical release-scope documents should remain historical unless a factual correction is required.