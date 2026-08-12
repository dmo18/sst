# Full product cleanup continuation record

Date: 2026-08-11
Branch: `agent/full-product-cleanup-2026-08-11`
Audited baseline: `befceebc73363dc292cb94c560cc637b99d36d8e`
Baseline production product-evidence run: `31553086715`
Baseline production artifact: `9124977352`

## Why this record exists

After the provider identity work reached production, the repository and the retained production screenshots were reviewed as a whole rather than treating the next visible defect in isolation. The goal of this pass is to remove the remaining product-quality, startup, bundle, verification, accessibility, and repository-history defects that were visible or provable from the current code and evidence.

This record is the handoff point for that review. It distinguishes defects observed in production evidence from architecture debt inferred from code and records the exact implementation used to address each item.

## Audit inputs

The review covered:

1. Recent main history and pull requests through provider artwork PR #135.
2. Current source entrypoints, responsive CSS, product-depth workspace code, provider identity code, favicon build pipeline, and post-deploy verifiers.
3. The successful production evidence bundle from product-experience run `31553086715`.
4. Desktop and mobile screenshots for overview, providers, Microsoft 365, Dependency Universe, universal search, and Incident Focus.
5. Open repository state, including draft pull requests left behind by superseded implementation streams.

## Defect register

### 1. Dependency Universe desktop density

Observed in `operator-universe.png` from the baseline production artifact.

The graph placed providers around category-local mini-orbits. With 31 categories and 80 providers, category clusters and provider labels collided heavily. The screen technically contained the expected graph but was difficult to scan.

Resolution:

- `buildUniverseGraph()` now places all providers around a global outer orbit.
- Category anchors sit on an inner orbit at the circular mean of their provider positions.
- Membership and cautious temporal-correlation edges are preserved.
- Default healthy label noise is suppressed. Warning, critical, pinned, replayed, hovered, and focused nodes remain labeled.

### 2. Dependency Universe mobile unreadability

Observed in `operator-universe-mobile.png` from the baseline production artifact.

The mobile verifier accepted a graph whose text was effectively microscopic. Previous mobile polish increased SVG scale but did not solve the underlying clustered geometry or label density.

Resolution:

- The global-orbit geometry reduces concentrated clusters.
- `src/styles/product-quality-cleanup.css` increases mobile graph footprint and important provider label size.
- Positive provider labels and category labels are suppressed by default on compact mobile evidence, while warning, critical, pinned, replayed, hover, and focus states remain discoverable.

### 3. Product verifier could pass an unreadable graph

Observed in `scripts/verify-product-depth-experience.mjs`.

The verifier checked structure, provider counts, overflow, evidence wording, and screenshot byte size, but it did not measure whether the graph occupied the screen or whether labels were legible and non-overlapping.

Resolution:

- Production verification now records graph width and height.
- It measures visible SVG-label median height.
- It counts pairwise label collisions.
- It fails when desktop or mobile graph footprint is too small, label size is too small, or collision density is excessive.
- The verifier log now publishes these metrics with the screenshot evidence.

### 4. Universal search repeated semantic history rows

Observed in `operator-search.png` from the baseline production artifact.

A provider query could be followed by many duplicate history entries with the same provider, change type, and title. This made the command search noisy and pushed more useful results down the list.

Resolution:

- Search indexing now sorts bounded history newest-first and deduplicates by provider, change type, and normalized title before indexing.
- Ranking remains title-first and provider-first.
- Unit tests cover repeated semantic history records.
- Production search verification now fails if duplicate semantic result rows are rendered.

### 5. Provider artwork inflated the main JavaScript chunk

Observed in the successful baseline release build.

The initial real-logo implementation embedded 35 wrapped provider images as data URIs in `src/generated/providerFavicons.ts`. The release was correct but Vite reported a main JavaScript chunk above its 500 KB warning threshold. The provider-logo continuation record already identified static local artwork as the preferred follow-up.

Resolution:

- `scripts/sync-provider-favicons.mjs` now writes each resolved provider mark as a local SVG file under `public/assets/logos/provider-favicons/` during verified builds.
- `src/generated/providerFavicons.ts` contains only local asset paths.
- The generated artwork directory is ignored by source control because it is build output.
- Real fetched artwork uses `provider-logo--favicon`; `provider-logo--generated` is now reserved for the emergency letter fallback.
- Provider production verification requires 35 favicon-backed identities, zero generated fallbacks, zero embedded SVG data URIs, and all 80 provider identities resolving through local assets.

### 6. Scaled desktop behavior still depended on runtime CSSOM mutation

Observed in `src/main.tsx` and inherited from render-recovery PR #134.

The previous recovery waited for stylesheet links, walked `document.styleSheets`, rewrote compact media queries, and only then mounted React. It fixed the immediate race but kept startup dependent on CSSOM timing and browser rule mutation.

Resolution:

- The runtime stylesheet wait and CSSOM mutation have been removed from `src/main.tsx`.
- A Vite pre-transform now constrains every `max-width` breakpoint at or below 900px with an equal `max-device-width` condition.
- This applies in development and production before browser runtime.
- Wider desktop responsive breakpoints remain width-driven.
- The provider production verifier still exercises a 720px viewport on a 1440px desktop screen and requires the desktop shell, sidebar, and table header geometry.

### 7. Dependency nodes advertised keyboard-button semantics without keyboard activation

Observed in `src/ProductDepthLayer.tsx`.

Category and provider SVG groups had `role="button"` and `tabIndex={0}` but only click handlers. Escape also did not reliably close the command workspace when focus was inside a form field.

Resolution:

- Enter and Space now activate focused category and provider nodes.
- Interactive node labels are exposed through `aria-label` and `<title>`.
- The SVG is an interactive group rather than a single image role.
- Escape closes the open command workspace before the typing shortcut guard.
- Regression tests lock these semantics.

### 8. Stale open draft PR #93 represented an obsolete wallboard stream

Observed in repository history.

PR #93, `Reduce wallboard heading size by 15%`, was still open and draft from main at `b7c657e6cdb6242ed3967de4efa4522ef935e01b`. It predates the later wallboard, premium product, responsive-shell, render-recovery, and provider-identity releases.

Resolution:

- PR #93 was documented as superseded and closed without merge.
- This removes a misleading obsolete implementation branch from the active review surface.

## Files changed in this cleanup stream

- `src/operatorWorkspace.ts`
- `src/__tests__/operatorWorkspace.test.ts`
- `src/ProductDepthLayer.tsx`
- `src/main.tsx`
- `src/providerIcon.tsx`
- `src/styles/product-quality-cleanup.css`
- `src/styles/provider-identity.css`
- `vite.config.ts`
- `scripts/provider-favicon-utils.mjs`
- `scripts/sync-provider-favicons.mjs`
- `scripts/verify-provider-identity.mjs`
- `scripts/verify-product-depth-experience.mjs`
- `scripts/__tests__/provider-favicon-sync.test.js`
- `scripts/__tests__/provider-identity-nuso.test.js`
- `scripts/__tests__/product-depth.test.js`
- `.gitignore`
- this continuation record

## Verification contract

Do not merge this cleanup based only on source review. The required sequence is:

1. Pull-request source quality, unit tests, TypeScript, application build, provider validation, and dependency audit must pass.
2. The verified build must still report `FAVICON_SYNC resolved=35 configured=35 minimum=35 failures=0`.
3. The application build should no longer report the previous main-JavaScript provider-artwork size warning.
4. CodeQL must pass.
5. After merge and Pages deployment, the premium product-experience workflow must pass all operator, product-depth, Microsoft 365, provider identity, and NUSO checks.
6. Review the new desktop and mobile Dependency Universe screenshots directly. Structural CI success is not sufficient.
7. Review universal search evidence and confirm repeated same-provider history rows no longer flood the result list.
8. Review provider desktop/mobile evidence and confirm real artwork remains recognizable with zero normal generated-letter fallbacks.

## Pending evidence

At the time this record was created, implementation was complete on the cleanup branch but pull-request and production verification had not yet run. Append the PR number, final head SHA, CI run IDs, merge SHA, Pages run, product-experience run, artifact ID, measured Universe readability metrics, and visual acceptance result before declaring the stream closed.

## Continuation point

If a future regression occurs, start from the measured production contracts rather than adding another visual override layer. In particular:

- Dependency Universe changes should preserve the global provider orbit and the production label-collision gate.
- New compact breakpoints at or below 900px should flow through the Vite device-width transform instead of browser CSSOM mutation.
- Provider artwork should remain local static build output, not JavaScript-embedded image data.
- Search history should stay semantically deduplicated before ranking.
- Repository continuation records should be updated whenever a substantial recovery or implementation stream changes these contracts.
