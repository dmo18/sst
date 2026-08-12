# Full product cleanup continuation record

Date: 2026-08-11
Status: complete
Audited baseline: `befceebc73363dc292cb94c560cc637b99d36d8e`
Final product implementation SHA: `92c60b7fe687130af52658c3a34c45a75851644e`
Final production release: #847, run `31555557698`
Final product-experience run: #48, run `31555648903`
Final product-experience artifact: `9125894718`

## Why this record exists

After the provider identity work reached production, the repository and retained production screenshots were reviewed as a whole rather than treating the next visible defect in isolation. The goal of this pass was to remove the remaining product-quality, startup, bundle, verification, accessibility, and repository-history defects that were visible or provable from the current code and evidence.

This record is the continuation and closure point for that review. It distinguishes defects observed in production evidence from architecture debt inferred from code and records the implementation and production proof for each item.

## Audit inputs

The review covered:

1. Recent main history and pull requests through provider artwork PR #135.
2. Current source entrypoints, responsive CSS, product-depth workspace code, provider identity code, favicon build pipeline, and post-deploy verifiers.
3. The successful provider-artwork production evidence bundle from product-experience run `31553086715`.
4. Desktop and mobile screenshots for overview, providers, Microsoft 365, Dependency Universe, universal search, and Incident Focus.
5. Open repository state, including draft pull requests left behind by superseded implementation streams.
6. Every subsequent cleanup release and product-experience artifact until direct screenshot acceptance was achieved.

## Defect register and final resolution

### 1. Dependency Universe desktop density

Observed in `operator-universe.png` from the baseline production artifact.

The graph placed providers around category-local mini-orbits. With 31 categories and 80 providers, category clusters and provider labels collided heavily. The screen technically contained the expected graph but was difficult to scan.

Resolution:

- `buildUniverseGraph()` places all providers around a global outer orbit.
- Category anchors sit on an inner orbit at the circular mean of their provider positions.
- Membership and cautious temporal-correlation edges are preserved.
- Default healthy label noise is suppressed. Warning, critical, pinned, replayed, hovered, and focused nodes remain labeled on desktop.
- Production verification measures graph footprint, visible label height, and collision count.

### 2. Dependency Universe mobile unreadability

Observed in `operator-universe-mobile.png` from the baseline production artifact and again during direct review of the first cleanup release.

The initial mobile verifier accepted a graph whose text was effectively microscopic. The first cleanup improved measured legibility, but direct screenshot review then found the graph over-scaled beyond the phone viewport, labels clipped on both sides, category anchors remained too dense, and a duplicate fixed replay-evidence pill obscured the replay controls.

Resolution:

- The global-orbit geometry reduces concentrated clusters.
- `src/styles/product-quality-cleanup.css` bounds mobile graph scale, reduces category-anchor size, and keeps category names interaction-driven.
- On compact layouts, default provider text is suppressed. Critical, pinned, replayed, hovered, and focused providers remain labeled; warning/watch providers remain visible as topology without flooding the screen with text.
- The duplicate fixed truth-boundary pill is hidden on compact layouts because the replay panel already states the evidence boundary in context.
- Right-half provider labels anchor inward to the left; left-half labels anchor inward to the right.
- The final production mobile evidence contains four visible provider labels, zero collisions, zero clipped labels, 15.3 px median label height, and a 483.6x628 px graph footprint in the 390x844 viewport.
- Direct screenshot review accepted the final mobile composition. The graph remains inside the intended visual field, labels are legible, replay controls are unobscured, and no duplicate replay pill is present.

### 3. Product verifier could pass an unreadable graph

Observed in `scripts/verify-product-depth-experience.mjs`.

The verifier checked structure, provider counts, overflow, evidence wording, and screenshot byte size, but it did not measure whether the graph occupied the screen or whether labels were legible and non-overlapping.

Resolution:

- Production verification records graph width and height.
- It measures visible SVG-label median height.
- It counts pairwise label collisions.
- Mobile verification enforces both minimum and maximum graph width.
- Mobile verification requires zero visible labels clipped against the viewport.
- Search verification rejects duplicate semantic result rows.
- The mobile screenshot and a `PRODUCT_DEPTH_MOBILE_METRICS` line are captured before strict visual assertions, so any future failed gate retains the rejected frame and measurements for diagnosis.
- The stricter gate proved itself in production by rejecting product-experience run #47 when exactly one mobile label clipped.

### 4. Universal search repeated semantic history rows

Observed in `operator-search.png` from the baseline production artifact.

A provider query could be followed by many duplicate history entries with the same provider, change type, and title. This made the command search noisy and pushed more useful results down the list.

Resolution:

- Search indexing sorts bounded history newest-first and deduplicates by provider, change type, and normalized title before indexing.
- Ranking remains title-first and provider-first.
- Unit tests cover repeated semantic history records.
- Production search verification fails if duplicate semantic result rows are rendered.
- Final product-experience run #48 returned seven results for the live Kaseya query with `duplicates=0`.
- Direct screenshot review accepted the final search view.

### 5. Provider artwork inflated the main JavaScript chunk

Observed in the successful provider-artwork baseline release build.

The initial real-logo implementation embedded 35 wrapped provider images as data URIs in `src/generated/providerFavicons.ts`. The release was correct but Vite reported a main JavaScript chunk above its 500 KB warning threshold.

Resolution:

- `scripts/sync-provider-favicons.mjs` writes each resolved provider mark as a local SVG file under `public/assets/logos/provider-favicons/` during verified builds.
- `src/generated/providerFavicons.ts` contains only local asset paths.
- The generated artwork directory is ignored by source control because it is build output.
- Real fetched artwork uses `provider-logo--favicon`; `provider-logo--generated` is reserved for the emergency letter fallback.
- Provider production verification requires 35 favicon-backed identities, zero generated fallbacks, zero embedded SVG data URIs, and all 80 provider identities resolving through local assets.
- The main JavaScript chunk fell from 535.23 KB to 384.03 KB without changing or suppressing Vite's default warning threshold.
- Final product-experience run #48 reported `exact_masks=35`, `favicons=35`, `generated_fallbacks=0`, `static_favicon_assets=35`, `local_assets=80`, and `unique_assets=78`.
- Direct desktop and mobile provider screenshot review accepted the real provider artwork, including NUSO.

The dedicated source and maintenance policy remains recorded in `docs/continuation/2026-08-11-provider-logo-recognition.md`.

### 6. Scaled desktop behavior still depended on runtime CSSOM mutation

Observed in `src/main.tsx` and inherited from render-recovery PR #134.

The previous recovery waited for stylesheet links, walked `document.styleSheets`, rewrote compact media queries, and only then mounted React. It fixed the immediate race but kept startup dependent on CSSOM timing and browser rule mutation.

Resolution:

- The runtime stylesheet wait and CSSOM mutation are removed from `src/main.tsx`.
- A Vite pre-transform constrains every `max-width` breakpoint at or below 900px with an equal `max-device-width` condition.
- This applies in development and production before browser runtime.
- Wider desktop responsive breakpoints remain width-driven.
- Final provider production verification exercised a 720px viewport on a 1440px desktop screen and reported `scaled_shell=grid`, with the desktop shell retained and the mobile sidebar reserved for actual mobile device metrics.

### 7. Dependency nodes advertised keyboard-button semantics without keyboard activation

Observed in `src/ProductDepthLayer.tsx`.

Category and provider SVG groups had `role="button"` and `tabIndex={0}` but only click handlers. Escape also did not reliably close the command workspace when focus was inside a form field.

Resolution:

- Enter and Space activate focused category and provider nodes.
- Interactive node labels are exposed through `aria-label` and `<title>`.
- The SVG is an interactive group rather than a single image role.
- Escape closes the open command workspace before the typing shortcut guard.
- Regression tests lock these semantics.

### 8. Stale open draft PR #93 represented an obsolete wallboard stream

Observed in repository history.

PR #93, `Reduce wallboard heading size by 15%`, was still open and draft from main at `b7c657e6cdb6242ed3967de4efa4522ef935e01b`. It predates later wallboard, premium product, responsive-shell, render-recovery, and provider-identity releases.

Resolution:

- PR #93 was documented as superseded and closed without merge.
- This removes a misleading obsolete implementation branch from the active review surface.

## Files changed in the cleanup stream

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
- `docs/continuation/2026-08-11-provider-logo-recognition.md`

## Verification contract retained after closure

Future changes to these systems should preserve the following release requirements:

1. Pull-request source quality, deterministic tests, TypeScript, application build, provider validation, and dependency audit pass.
2. Provider artwork build reports `FAVICON_SYNC resolved=35 configured=35 minimum=35 failures=0` while the current 35-provider configured set remains unchanged.
3. Provider artwork stays local static build output rather than image data embedded in JavaScript.
4. CodeQL passes.
5. Pages release completes deployed smoke, current Chrome rendering, pinned pre-cascade-layer Chromium, and 458x291 Yodeck verification.
6. Post-deploy product-experience verification passes operator, Product Depth, Microsoft 365, provider identity, and NUSO checks.
7. Dependency Universe production verification retains footprint, label-height, collision, maximum mobile width, and zero-clipping requirements.
8. Direct review of retained desktop and mobile screenshots remains part of acceptance. Automated success does not override a visibly bad render.
9. Failed visual assertions retain their rejected screenshot and metrics.

## Verification history

### PR #136: full product cleanup

- Branch: `agent/full-product-cleanup-2026-08-11`
- Pull request: #136, `Finish full product cleanup and harden visual verification`
- Final PR head: `98a064934a17d4d621fb8fc4c8f37cd74e7ed156`
- Pull-request checks: run `31554417315`, success
- CodeQL: run `31554417343`, success
- Deterministic suite: 347 tests passed
- Artwork sync: 35 of 35 resolved, zero failures
- Main JavaScript bundle: reduced from 535.23 KB to 384.03 KB without changing the warning threshold
- Merge SHA: `75a1dddc77591c34f21b326d0d1d828053ce98ac`
- Production release #845: run `31554526482`, success
- Product-experience run #46: `31554618865`, success
- Product-experience artifact: `9125530213`
- Desktop Universe metrics: 80 providers, 31 categories, 39 visible labels, 7 collisions, 11.5 px median label height, 1052x592 px graph footprint
- Search evidence: six results for the live Cloudflare query, zero duplicate semantic rows
- First mobile metrics: 33 visible labels, 10 collisions, 13.6 px median label height, 741x962.3 px graph footprint
- Direct visual result: desktop and search accepted as materially improved; mobile Universe rejected because the graph was over-scaled, labels clipped at both sides, category anchors were dense, and the duplicate fixed replay-evidence pill obscured controls

The direct visual rejection overruled automated success and produced PR #137 rather than weakening visual expectations.

### PR #137: mobile visual acceptance tightening

- Branch: `fix/universe-mobile-visual-acceptance-2026-08-11`
- Pull request: #137, `Finish mobile Dependency Universe visual acceptance`
- Final PR head: `96d66f78bd3ff1ed3e4f70e76c6c31ceadb8fd07`
- Pull-request checks: run `31554923950`, success
- CodeQL: run `31554923891`, success
- Merge SHA: `837558593e2c87b116d270939c41bebd15174ec5`
- Production release #846: run `31554995745`, success across the full deployment and compatibility stack
- Product-experience run #47: `31555082289`, failed intentionally at the stricter Product Depth visual gate
- Failed evidence artifact: `9125704383`
- Exact gate result: `Mobile Dependency Universe clips 1 visible labels against the viewport.`

The failure proved the new gate was detecting a defect rather than merely recording metrics. The production deployment itself remained healthy.

### PR #138: inward label anchoring and retained rejected evidence

- Branch: `fix/universe-label-anchor-2026-08-11`
- Pull request: #138, `Anchor Dependency Universe labels inside the viewport`
- Final PR head: `f8e811176f2771863b9575f90af3c7250e97a1e1`
- Pull-request checks: run `31555456128`, success
- Pull-request CodeQL: run `31555456118`, success
- Merge SHA: `92c60b7fe687130af52658c3a34c45a75851644e`
- Post-merge CodeQL: run `31555557704`, success
- Production release #847: run `31555557698`, success across Pages, deployed smoke, current Chrome, pinned legacy Chromium, and Yodeck verification
- Product-experience run #48: `31555648903`, success
- Product-experience artifact: `9125894718`
- Final desktop Universe: 80 providers, 31 categories, 33 visible labels, 9 collisions, 11.5 px median label height, 1052x592 px graph footprint
- Final mobile Universe: 80 providers, 4 visible labels, 0 collisions, 0 clipped labels, 15.3 px median label height, 483.6x628 px graph footprint in the 390x844 viewport
- Final search: seven results for the live Kaseya query, zero duplicate semantic rows
- Final provider identity: 35 exact masks, 35 fetched artwork marks, zero generated fallbacks, 35 static favicon assets, 80 local assets, 78 unique local assets
- Final scaled desktop: 720px viewport on 1440px screen retained `scaled_shell=grid`
- Final NUSO: present and visible in mobile provider evidence
- Direct screenshot review: desktop Universe accepted; mobile Universe accepted with inward labels and unobscured replay controls; search accepted; provider desktop and mobile accepted

## Closure

The full cleanup stream is complete at product implementation SHA `92c60b7fe687130af52658c3a34c45a75851644e`, backed by successful release #847, successful post-merge CodeQL, successful product-experience run #48, retained artifact `9125894718`, and direct screenshot review.

The important lesson from this stream is that structural and metric checks are necessary but not sufficient. PR #136 passed its first-generation mobile metrics but failed direct visual review. PR #137 then introduced a stricter zero-clipping gate and correctly rejected a remaining one-label defect. PR #138 fixed the geometry without weakening the gate and produced the accepted production evidence.

## Continuation point

If a future regression occurs, start from the measured production contracts rather than adding another visual override layer. In particular:

- Dependency Universe changes should preserve the global provider orbit, inward edge label anchoring, compact label policy, and production footprint, collision, and zero-clipping gates.
- New compact breakpoints at or below 900px should flow through the Vite device-width transform instead of browser CSSOM mutation.
- Provider artwork should remain local static build output, not JavaScript-embedded image data.
- Search history should stay semantically deduplicated before ranking.
- Failed visual assertions should retain their screenshot evidence.
- Repository continuation records should be updated whenever a substantial recovery or implementation stream changes these contracts.
