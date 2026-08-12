# Provider logo recognition continuation record

Date: 2026-08-11
Branch: `fix/provider-logo-favicons`
Baseline: `main` after render recovery merge `8cc2e21cd4cb0bf6dbe7a19e8b1450976750c22c`

## Why this record exists

Provider identity was visually improved in the earlier product-depth work, but 35 canonical providers still used generated recognition tiles made from letters such as `S1`, `CW`, `HALO`, and `NUSO`. Those tiles are deterministic and colorful, but they are not sufficiently recognizable for fast operator scanning.

The user requested provider marks that resemble the real service logos and colors, and specifically suggested website favicons as a practical source.

## Existing identity contract preserved

The recovery keeps the existing provider identity guarantees:

1. Committed exact vector marks remain preferred where they already exist.
2. The deployed browser does not load provider art from external domains at runtime.
3. Provider identity remains available when a favicon cannot be resolved.
4. NUSO remains a first-class canonical provider.
5. The existing provider identity verifier continues to see embedded SVG identity assets and local exact-logo references.

## Implementation

### Build-time favicon acquisition

`config/provider-favicon-sources.json` lists the 35 canonical providers that previously depended on generated letter tiles. It also defines the minimum favicon resolution count required for a verified build.

`scripts/sync-provider-favicons.mjs` runs as part of `npm run build:app` before Vite builds the application. For each configured provider it:

1. Reads the canonical provider catalog after consolidation.
2. Derives the provider's official status-site origin from the configured public source URL.
3. Loads the status page when available and inspects standard `link rel="icon"` and Apple touch icon declarations.
4. Falls back to conventional `/favicon.png`, `/favicon.ico`, and `/apple-touch-icon.png` paths.
5. Rejects oversized or unsupported image responses.
6. Extracts embedded PNG images from modern ICO containers when necessary.
7. Wraps the real favicon bytes in a local SVG data URI for consistent 40px provider rendering.
8. Generates `src/generated/providerFavicons.ts` for the release build.
9. Writes `public/assets/logos/provider-favicon-sources.json` with source URLs, media types, sizes, and SHA-256 digests.

### Runtime behavior

`src/providerIcon.tsx` now checks the generated favicon map before falling back to the existing recognition tile. Favicon-backed providers keep the existing embedded SVG class contract so current render verification remains compatible.

If a favicon image fails to decode, the component immediately falls back to the existing deterministic tile. No runtime network request is introduced.

## Verification strategy

The new `scripts/__tests__/provider-favicon-sync.test.js` covers:

1. Exact coverage of the 35 providers that previously used generated recognition brands.
2. Correct status-site origin derivation.
3. Favicon link discovery and conventional fallback paths.
4. Image normalization and SVG data URI wrapping.
5. Provider UI preference for the build-generated favicon map.
6. Presence of the favicon sync step in the application build command.

The existing provider identity and NUSO verification remains in place. Because fetched favicons are embedded inside SVG data URIs, the browser verifier still sees embedded local provider identity rather than external image sources.

## Release gate

The first CI run for this branch must prove that the GitHub-hosted build environment can resolve at least the configured minimum of 24 favicons from the 35 targeted providers. If the threshold is too high because specific official status sites block build-time requests, adjust only after reviewing the actual failure list. Do not weaken the runtime no-external-image contract.

After deployment, inspect the provider desktop and mobile evidence. The success criterion is visual, not only numeric: the providers that previously displayed letter tiles should now show distinctive real favicon geometry and native brand colors wherever the official status site exposes a usable icon.

## Continuation point

After this change is deployed and visually verified:

1. Promote especially important providers from favicon recognition to pinned exact vector marks when official brand assets are available and licensing is clear.
2. Keep favicons as the general long-tail recognition layer for monitored vendors without committed vector assets.
3. Keep the generated letter tile only as the final error and unknown-provider fallback.
4. Record future provider identity source changes in `public/assets/logos/BRAND-SOURCES.md` and the relevant continuation record.
