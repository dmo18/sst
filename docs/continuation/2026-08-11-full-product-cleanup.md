# Full product cleanup continuation record

Date: 2026-08-11
Active follow-up branch: `fix/universe-label-anchor-2026-08-11`
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
- Default healthy label noise is suppressed. Warning, critical, pinned, replayed, hovered, and focused nodes remain labeled on desktop.

### 2. Dependency Universe mobile unreadability

Observed in `operator-universe-mobile.png` from the baseline production artifact and again during direct review of the first cleanup release.

The initial mobile verifier accepted a graph whose text was effectively microscopic. The first cleanup improved measured legibility but direct screenshot review then found the graph over-scaled beyond the phone viewport, labels clipped on both sides, category anchors remained too dense, and a duplicate fixed replay-evidence pill obscured the replay controls.

Resolution stream:

- The global-orbit geometry reduces concentrated clusters.
- `src/styles/product-quality-cleanup.css` bounds the mobile graph scale, reduces category-anchor size, and keeps category names interaction-driven.
- On compact layouts, default provider text is suppressed. Critical, pinned, replayed, hovered, and focused providers remain labeled; warning/watch providers remain visible as topology without flooding the screen with text.
- The duplicate fixed truth-boundary pill is hidden on compact layouts because the replay panel already states the evidence boundary in context.
- Right-half provider labels now anchor inward to the left; left-half labels anchor inward to the right so highlighted labels do not extend blindly beyond the viewport edge.

### 3. Product verifier could pass an unreadable graph

Observed in `scripts/verify-product-depth-experience.mjs`.

The verifier checked structure, provider counts, overflow, evidence wording, and screenshot byte size, but it did not measure whether the graph occupied the screen or whether labels were legible and non-overlapping.

Resolution:

- Production verification records graph width and height.
- It measures visible SVG-label median height.
- It counts pairwise label collisions.
- Mobile verification enforces a maximum graph width as well as minimum footprint.
- Mobile verification requires zero visible labels clipped against the viewport.
- Search verification rejects duplicate semantic result rows.
- The mobile screenshot and a `PRODUCT_DEPTH_MOBILE_METRICS` line are now captured before strict visual assertions, so any future failed gate retains the rejected frame and its metrics for diagnosis.

### 4. Universal search repeated semantic history rows

Observed in `operator-search.png` from the baseline production artifact.

A provider query could be followed by many duplicate history entries with the same provider, change type, and title. This made the command search noisy and pushed more useful results down the list.

Resolution:

- Search indexing now sorts bounded history newest-first and deduplicates by provider, change type, and normalized title before indexing.
- Ranking remains title-first and provider-first.
- Unit tests cover repeated semantic history records.
- Production search verification fails if duplicate semantic result rows are rendered.

### 5. Provider artwork inflated the main JavaScript chunk

Observed in the successful baseline release build.

The initial real-logo implementation embedded 35 wrapped provider images as data URIs in `src/generated/providerFavicons.ts`. The release was correct but Vite reported a main JavaScript chunk above its 500 KB warning threshold. The provider-logo continuation record already identified static local artwork as the preferred follow-up.

Resolution:

- `scripts/sync-provider-favicons.mjs` writes each resolved provider mark as a local SVG file under `public/assets/logos/provider-favicons/` during verified builds.
- `src/generated/providerFavicons.ts` contains only local asset paths.
- The generated artwork directory is ignored by source control because it is build output.
- Real fetched artwork uses `provider-logo--favicon`; `provider-logo--generated` is reserved for the emergency letter fallback.
- Provider production verification requires 35 favicon-backed identities, zero generated fallbacks, zero embedded SVG data URIs, and all 80 provider identities resolving through local assets.

### 6. Scaled desktop behavior still depended on runtime CSSOM mutation

Observed in `src/main.tsx` and inherited from render-recovery PR #134.

The previous recovery waited for stylesheet links, walked `document.styleSheets`, rewrote compact media queries, and only then mounted React. It fixed the immediate race but kept startup dependent on CSSOM timing and browser rule mutation.

Resolution:

- The runtime stylesheet wait and CSSOM mutation have been removed from `src/main.tsx`.
- A Vite pre-transform constrains every `max-width` breakpoint at or below 900px with an equal `max-device-width` condition.
- This applies in development and production before browser runtime.
- Wider desktop responsive breakpoints remain width-driven.
- The provider production verifier still exercises a 720px viewport on a 1440px desktop screen and requires the desktop shell, sidebar, and table header geometry.

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

Do not close this cleanup based only on source review. The required sequence is:

1. Pull-request source quality, unit tests, TypeScript, application build, provider validation, and dependency audit must pass.
2. The verified build must still report `FAVICON_SYNC resolved=35 configured=35 minimum=35 failures=0`.
3. The application build must remain below the previous main-JavaScript provider-artwork warning condition without raising or suppressing the Vite threshold.
4. CodeQL must pass.
5. After merge and Pages deployment, the premium product-experience workflow must pass all operator, product-depth, Microsoft 365, provider identity, and NUSO checks.
6. Review the new desktop and mobile Dependency Universe screenshots directly. Structural CI success is not sufficient.
7. Review universal search evidence and confirm repeated same-provider history rows no longer flood the result list.
8. Review provider desktop/mobile evidence and confirm real artwork remains recognizable with zero normal generated-letter fallbacks.
9. A failed visual gate must retain the rejected screenshot and measurements rather than only throwing an assertion.

## Verification history to date

### PR #136: full product cleanup

- Branch: `agent/full-product-cleanup-2026-08-11`
- Pull request: #136, `Finish full product cleanup and harden visual verification`
- Final PR head: `98a064934a17d4d621fb8fc4c8f37cd74e7ed156`
- Pull-request checks: run `31554417315`, success
- CodeQL: run `31554417343`, success
- Deterministic suite: 347 tests passed
- Artwork sync: 35 of 35 resolved, zero failures
- Main JavaScript bundle: reduced from 535.23 KB on the provider-artwork baseline to 384.03 KB without changing the warning threshold
- Merge SHA: `75a1dddc77591c34f21b326d0d1d828053ce98ac`
- Production release #845: run `31554526482`, success including Pages, deployed smoke, headless render, pinned pre-cascade-layer Chromium, and 458x291 Yodeck verification
- Product-experience run #46: `31554618865`, success
- Product-experience artifact: `9125530213`
- Desktop Universe metrics: 80 providers, 31 categories, 39 visible labels, 7 collisions, 11.5 px median label height, 1052x592 px graph footprint
- Search evidence: 6 results for the live Cloudflare query, zero duplicate semantic rows
- First mobile metrics: 33 visible labels, 10 collisions, 13.6 px median label height, 741x962.3 px graph footprint
- Direct visual result: desktop and search accepted as materially improved; mobile Universe rejected because the graph was over-scaled, labels clipped at both sides, category anchors were dense, and the duplicate fixed replay-evidence pill obscured controls

This rejection is important. The automated run passed, but direct screenshot review overruled closure and produced PR #137 rather than weakening visual expectations.

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

The failure proved the new gate was detecting a defect rather than merely recording metrics. Microsoft 365 and provider identity steps were skipped after Product Depth failed, while the production deployment itself remained healthy.

### Active label-anchor follow-up

Branch `fix/universe-label-anchor-2026-08-11` addresses the remaining one-label clipping condition without weakening the zero-clipping requirement:

- right-half provider labels use `text-anchor="end"` and are placed to the left of the node;
- left-half provider labels use `text-anchor="start"` and are placed to the right of the node;
- the mobile evidence frame is captured before strict visual assertions;
- mobile metrics are printed before the assertion so a future rejection is diagnosable from the retained artifact.

## Pending final evidence

The cleanup stream remains open until the label-anchor follow-up passes pull-request checks and CodeQL, merges, completes a healthy Pages release, passes the full post-deploy product-experience workflow, and the resulting mobile screenshot is directly accepted with zero clipped labels.

After that proof exists, append the follow-up PR number, merge SHA, production release run, product-experience run, artifact ID, final mobile metrics, direct screenshot result, and post-merge CodeQL result before declaring the stream closed.

## Continuation point

If a future regression occurs, start from the measured production contracts rather than adding another visual override layer. In particular:

- Dependency Universe changes should preserve the global provider orbit, inward edge label anchoring, and the production footprint, collision, and zero-clipping gates.
- New compact breakpoints at or below 900px should flow through the Vite device-width transform instead of browser CSSOM mutation.
- Provider artwork should remain local static build output, not JavaScript-embedded image data.
- Search history should stay semantically deduplicated before ranking.
- Failed visual assertions should retain their screenshot evidence.
- Repository continuation records should be updated whenever a substantial recovery or implementation stream changes these contracts.
