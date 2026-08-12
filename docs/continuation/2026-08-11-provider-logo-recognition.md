# Provider logo recognition continuation record

Date: 2026-08-11
Branch: `fix/provider-logo-favicons`
Baseline: `main` after render recovery merge `8cc2e21cd4cb0bf6dbe7a19e8b1450976750c22c`

## Why this record exists

Provider identity was visually improved in the earlier product-depth work, but 35 canonical providers still used generated recognition tiles made from letters such as `S1`, `CW`, `HALO`, and `NUSO`. Those tiles are deterministic and colorful, but they are not sufficiently recognizable for fast operator scanning.

The requested outcome is provider marks that resemble the real service logos and colors, with website favicons used as a practical source where a committed exact vector mark is not already available.

## Existing identity contract preserved

The implementation keeps the existing provider identity guarantees:

1. Committed exact vector marks remain preferred where they already exist.
2. The deployed browser does not load provider art from external domains at runtime.
3. Provider identity remains available when a favicon cannot be resolved.
4. NUSO remains a first-class canonical provider.
5. The existing provider identity verifier continues to see embedded SVG identity assets and local exact-logo references.

## Implementation

### Build-time favicon acquisition

`config/provider-favicon-sources.json` lists the 35 canonical providers that previously depended on generated letter tiles. It also defines the minimum favicon resolution count required for a verified build and optional official vendor website overrides.

`scripts/sync-provider-favicons.mjs` runs as part of `npm run build:app` before Vite builds the application. For each configured provider it:

1. Reads the canonical provider catalog after consolidation.
2. Uses an explicit official vendor website first when the source configuration provides one.
3. Falls back to the provider's official status-site origin derived from the configured public status source.
4. Loads each candidate page when available and inspects standard `link rel="icon"` and Apple touch icon declarations.
5. Falls back to conventional `/favicon.png`, `/favicon.ico`, and `/apple-touch-icon.png` paths for each page.
6. Rejects oversized or unsupported image responses.
7. Extracts embedded PNG images from modern ICO containers when necessary.
8. Wraps the real favicon bytes in a local SVG data URI for consistent 40px provider rendering.
9. Generates `src/generated/providerFavicons.ts` for the release build.
10. Writes `public/assets/logos/provider-favicon-sources.json` with source kind, source page, resolved icon URL, media type, size, and SHA-256 digest.

The vendor website override exists for two reasons. Some official status sites block favicon requests or expose no usable icon, and some hosted status systems expose a generic platform favicon instead of the monitored vendor's visual identity. Vendor-site priority makes operator recognition the primary objective while retaining the official status page as a useful fallback.

### Runtime behavior

`src/providerIcon.tsx` checks the generated favicon map before falling back to the existing recognition tile. Favicon-backed providers keep the existing embedded SVG class contract so current render verification remains compatible.

If a favicon image fails to decode, the component immediately falls back to the existing deterministic tile. No runtime network request is introduced.

## Verification strategy

The new `scripts/__tests__/provider-favicon-sync.test.js` covers:

1. Exact coverage of the 35 providers that previously used generated recognition brands.
2. Presence of official website overrides for known missing or generic status-page favicon cases.
3. Correct status-site origin derivation.
4. Favicon link discovery and conventional fallback paths.
5. Image normalization and SVG data URI wrapping.
6. Provider UI preference for the build-generated favicon map.
7. Vendor website priority with status-site fallback.
8. Presence of the favicon sync step in the application build command.

The existing provider identity and NUSO verification remains in place. Because fetched favicons are embedded inside SVG data URIs, the browser verifier still sees embedded local provider identity rather than external image sources.

## CI evidence

The first pull request build used status-site favicons only. All 333 tests, typecheck, production build, dependency audit, provider validation, and source quality checks passed. The real GitHub-hosted build resolved 26 of the 35 target providers, above the original minimum of 24.

That run also exposed the quality gap that motivated the source refinement. Nine providers did not resolve from their status origins, and at least one hosted status site exposed generic platform artwork. The implementation was therefore tightened before merge rather than accepting the first green build.

The refined configuration prioritizes official vendor websites for Sophos, HaloPSA, Kaseya, SuperOps, Proofpoint, Mimecast, Cove Data Protection, UltraDNS, Salesforce, and DocuSign, then falls back to the status site. The release minimum is now 28 resolved favicon-backed providers. The next CI result is the merge gate for this refined policy.

## Release gate

A merge is acceptable only when all repository checks remain green and the GitHub-hosted application build resolves at least 28 of the 35 target providers. Do not weaken the runtime no-external-image contract to increase this number.

After deployment, inspect the provider desktop and mobile evidence. The success criterion is visual, not only numeric: providers that previously displayed letter tiles should show distinctive real favicon geometry and native brand colors wherever an official vendor or status site exposes usable artwork.

## Continuation point

After this change is deployed and visually verified:

1. Promote especially important providers from favicon recognition to pinned exact vector marks when official brand assets are available and licensing is clear.
2. Keep official vendor website favicons as the preferred long-tail recognition layer when a committed vector is unavailable.
3. Keep official status-site favicons as secondary fallback because they are often convenient but may be generic on hosted status platforms.
4. Keep the generated letter tile only as the final error and unknown-provider fallback.
5. Watch bundle size because embedded favicon data increases the application JavaScript payload. If it becomes material, move generated favicon wrappers to local static files without changing the no-runtime-external-image contract.
6. Record future provider identity source changes in `public/assets/logos/BRAND-SOURCES.md` and the relevant continuation record.
