# Contributing

Use Node 22+, create focused changes, and preserve the static official-source-only architecture. Do not add credentials, unofficial outage data, browser vendor calls, generated `public/status.json`, TODO placeholders, or unsafe HTML. Provider changes must retain or deliberately update the catalog count, explain limited sources, and include parser fixtures when behavior changes.

Before submitting, run `npm ci`, `npm run validate-providers`, `npm test`, `npm run typecheck`, `npm run build:app`, and (when validating production feeds) `npm run update-status`. Use semantic, keyboard-accessible HTML; normal React escaping; safe external links; and blue diagnostics for uncertain source state. Update the changelog for releases. The PR workflow is deterministic; live retrieval belongs to the Pages workflow.
