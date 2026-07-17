# Repository report, verification, and plan ahead

## Current repository catalog

This repository is a v2-only static GitHub Pages MSP status dashboard. It contains a Vite/React browser app, a provider catalog, a status generation pipeline, and GitHub Actions workflows for build/test/deploy.

| Area | Files | Current role |
| --- | --- | --- |
| Browser entrypoint | `index.html`, `src/main.tsx` | Loads the React application and stylesheet through Vite. |
| App shell | `src/App.tsx` | Fetches `status.json`, refreshes every 60 seconds, falls back to the provider catalog on load failure, and passes a view model into the console UI. |
| Console UI | `src/IssueConsole.tsx`, `src/styles/app.css`, `src/logos.ts` | Renders active incidents, provider diagnostics, source detail, and UI styling/assets. |
| View model | `src/statusViewModel.ts` | Merges generated status data with the provider catalog so every configured provider remains visible. |
| Shared types | `src/types.ts` | Defines provider catalog, provider status, incident, summary, diagnostic, and payload structures. |
| Provider catalog | `config/providers.json` | Single configured-provider source consumed by validation, status generation, and browser fallback. |
| Status generation | `scripts/update-status.mjs` | Fetches official/limited source types and writes normalized status data to `public/status.json`. |
| Validation/build | `scripts/validate-providers.mjs`, `scripts/build.mjs`, `package.json`, `tsconfig.json`, `vite.config.ts` | Validates catalog shape, generates status, type-checks, and builds the Vite artifact. |
| Workflows | `.github/workflows/refresh-pages.yml`, `.github/workflows/refresh-pages-v2.yml`, `.github/workflows/test.yml`, `.github/workflows/cron-probe.yml` | Build, deploy, pull-request test, and schedule probe automation. |

## Active dependency graph

```text
index.html
  -> src/main.tsx
     -> src/App.tsx
        -> config/providers.json
        -> src/IssueConsole.tsx
        -> src/statusViewModel.ts
        -> src/types.ts
     -> src/styles/app.css

package.json scripts
  validate-providers -> scripts/validate-providers.mjs -> config/providers.json
  update-status      -> scripts/update-status.mjs      -> config/providers.json -> public/status.json
  build/test         -> scripts/build.mjs -> validate-providers -> update-status -> tsc --noEmit -> vite build

GitHub Actions
  refresh-pages.yml    -> npm install -> npm run build -> upload/deploy dist
  refresh-pages-v2.yml -> npm install -> npm run build -> upload/deploy dist
  test.yml             -> npm install -> npm test -> npm run build
```

## Legacy-removal verification report

The repository no longer contains the removed direct-DOM HUD implementation or retired fetcher scripts. The semantic verification covered names, imports, DOM renderer functions, old stylesheet references, and workflow/package entrypoints.

### Removed files verified absent

```text
scripts/fetch-status-v2.cjs
scripts/fetch-status.cjs
scripts/fetch-status.js
src/main.ts
src/render.ts
src/styles/hud.css
```

### Semantic searches performed

```bash
rg -n "fetch-status|from './render'|styles/hud\.css|renderStatus|renderLoadError" -g '!node_modules' -g '!dist' -g '!docs/**'
find src scripts -type f | sort
rg -n "src/main\.ts\b|src/render\.ts|hud\.css|summaryPill|renderLoadError|renderStatus" -g '!node_modules' -g '!dist' -g '!docs/**'
```

Expected result: no implementation references remain in runtime, build, or workflow paths. Documentation may mention removed filenames only in historical reports when necessary.

## V2 review

The v2 path satisfies the dashboard contract:

- The browser reads only the generated `status.json` and does not call vendor feeds directly.
- The build pipeline validates the provider catalog before generating status data.
- Status generation is centralized in `scripts/update-status.mjs` and writes `public/status.json` for the static site.
- The React app refreshes status data every 60 seconds and falls back to catalog-backed diagnostics if `status.json` cannot be loaded.
- The view model preserves every configured provider, including limited, failed, pending, and catalog-only providers.
- The issue console separates active incident briefs from provider diagnostics so the incident view stays focused while diagnostics remain complete.

## Required maintainer directions

- Bump both package and displayed app versions with every repository change.
- Keep `README.md`, `package.json`, and `src/App.tsx` versions in sync.
- Commit every completed change on the current branch.
- Prepare pull request metadata after each commit.
- Push and merge automatically only when a git remote, branch policy, and credentials are available in the environment; otherwise record that push/merge is blocked by repository configuration.

## Plan ahead

1. Add a small automated repository hygiene check that fails if removed legacy filenames or renderer symbols reappear in runtime/build paths.
2. Consolidate duplicate Pages deployment workflows if both `refresh-pages.yml` and `refresh-pages-v2.yml` are not required.
3. Move the app version to a single source of truth so `package.json`, `README.md`, and the displayed app version cannot drift.
4. Add unit coverage for `buildIssueConsoleModel` to verify catalog fallback, provider visibility, color mapping, and active-incident filtering.
5. Consider separating generated status updates from code-only commits if status feed churn creates noisy diffs.
