# Repository architecture report

## Trust boundary

The product is a static React/Vite console backed by an atomically generated schema-v2 `status.json`. GitHub Actions alone retrieves official vendor sources. Browser traffic is same-origin static content only. Explicit service, source and attention states drive every aggregate and visual; prose and color never infer health. Generator and browser validation reconcile provider, incident and coverage counts, unique identities, references, URLs, timestamps and allowed enums, preventing false-green output.

The browser includes a bounded schema-v1 deployment bridge. It conservatively migrates a valid legacy payload in memory and then subjects the result to the full schema-v2 validator. Legacy green is treated as unknown service health, source availability remains separate, malformed entries fail closed, and the generated file is never modified by the browser. This avoids bundle/status rollout-order failures while preserving schema-v2 semantics.

## Wallboard architecture

`wallboardConfig.ts` centralizes screens, labels, query parsing, rotation bounds, density, page sizes and 40/60-minute stale thresholds. `Wallboard.tsx` renders a fixed full-viewport safe-area layout with Heads Up, paginated All Providers, and paginated Source Health screens. Rotation uses controlled hard transitions, respects reduced motion, pauses after interaction and pins critical incidents to Heads Up. An isolated clock updates each second while age treatment updates once per minute.

The status bar contains local date/time, generated time, successful/failed browser checks, age, overall states, coverage, Fullscreen API control and optional Screen Wake Lock control. Provider icons are bundled local marks or deterministic monograms; all enabled catalog entries are reachable without external image requests. The operator console remains reading-width constrained and retains full diagnostics, search, filters, guidance, history and drafts.

## Automation

- `test.yml`: deterministic Node 22 checks with `npm ci`, catalog validation, tests, strict typecheck and Vite build; no vendors.
- `refresh-pages.yml`: the only Pages workflow. A `contents: read` job performs checks, optional validated history retrieval, one live generation and one Vite build. A dependent job alone has Pages/OIDC write permissions and deploys one artifact.
- Generated `public/status.json`, prior snapshots, `dist`, screenshots and test output remain uncommitted.

The primary wallboard contract is 1920×1080 at 100% zoom, with responsive 4K, 1366×768 and 1280×720 support. Operator layout supports 1440×900 through 320px. Microsoft tenant health remains deliberately limited because authenticated Graph access is outside the public static trust boundary.
