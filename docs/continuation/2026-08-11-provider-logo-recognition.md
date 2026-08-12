# Provider logo recognition continuation record

Date: 2026-08-11
Branch: `fix/provider-logo-favicons`
Baseline: `main` after render recovery merge `8cc2e21cd4cb0bf6dbe7a19e8b1450976750c22c`

## Why this record exists

Provider identity was visually improved in the earlier product-depth work, but 35 canonical providers still used generated recognition tiles made from letters such as `S1`, `CW`, `HALO`, and `NUSO`. Those tiles were deterministic and colorful, but they were not sufficiently recognizable for fast operator scanning.

The requested outcome is provider marks that resemble the real service logos and colors, with official website favicons used as a practical long-tail source where a committed exact vector mark is not already available.

## Identity contract preserved

The implementation keeps the existing provider identity guarantees:

1. Existing committed exact vector and native local marks remain preferred.
2. The deployed browser does not load provider art from external domains at runtime.
3. NUSO remains a first-class canonical provider.
4. Existing provider identity verification continues to see local or embedded assets rather than third-party browser requests.
5. The deterministic letter tile remains only as a defensive runtime decode fallback, not the normal presentation for the 35 targeted providers.

## Final source hierarchy

The provider identity source order is:

1. Existing committed exact vector or native local mark.
2. Explicit pinned artwork from an official vendor or official product documentation site.
3. Favicon discovered from an explicit official vendor website override.
4. Favicon discovered from the provider's configured official status-site origin.
5. Deterministic provider-specific letter tile only if an already built identity unexpectedly cannot be decoded at runtime.

The source configuration lives in `config/provider-favicon-sources.json`. It names the exact 35 providers that previously depended on generated letter tiles and requires all 35 to resolve during a verified application build.

## Build-time implementation

`scripts/sync-provider-favicons.mjs` runs as part of `npm run build:app` before Vite builds the application. For each configured provider it:

1. Reads the canonical provider catalog after consolidation.
2. Tries an explicit pinned official asset when one is configured.
3. Tries an explicit official vendor website when one is configured.
4. Falls back to the provider's official status-site origin derived from the configured public status source.
5. Inspects standard favicon and Apple touch icon declarations and conventional favicon paths.
6. Validates image media type and byte size.
7. Supports PNG, SVG, JPEG, GIF, WEBP, modern ICO files with embedded PNG frames, and legacy ICO files.
8. Wraps the accepted bytes in a local SVG data URI for consistent provider rendering.
9. Generates `src/generated/providerFavicons.ts` for the release build.
10. Writes `public/assets/logos/provider-favicon-sources.json` with source kind, page, resolved asset URL, media type, size, and SHA-256 digest.

Discovered favicons remain capped at 64 KB. Explicitly pinned official assets use a separate 512 KB ceiling. This permits a documented vendor or product logo to be used without weakening the size limit applied to arbitrary favicon discovery.

## Runtime behavior

`src/providerIcon.tsx` checks the generated provider artwork map before falling back to the pre-existing recognition tile for the formerly generated provider set. Exact committed brand-mask and native assets continue through their existing paths.

The favicon and official artwork bytes are already embedded in the built application. The browser does not contact the provider, a logo CDN, or a favicon service. If an embedded image unexpectedly cannot decode, the deterministic provider-specific tile is used as an emergency presentation fallback.

## Regression coverage

`scripts/__tests__/provider-favicon-sync.test.js` covers:

1. Exact coverage of all 35 formerly generated recognition brands.
2. A required `minimumResolved` value of 35.
3. Vendor website and official asset override configuration.
4. Status-site origin derivation.
5. Favicon link discovery and conventional fallback paths.
6. Image normalization and SVG data URI wrapping.
7. Legacy ICO support.
8. Product-specific background plates for reversed artwork.
9. Separate 64 KB discovered-icon and 512 KB pinned-official-asset ceilings.
10. Provider UI preference for the build-generated artwork map.
11. Presence of the artwork sync step in the application build command.
12. No runtime external image URL added to `src/providerIcon.tsx`.

The existing provider identity and NUSO verification remains in place.

## CI investigation and refinements

### Pass 1: status-site favicon discovery

The first implementation used status-site favicons only. All repository gates were green and the GitHub-hosted build resolved 26 of the 35 target providers. Nine providers did not resolve, and at least one hosted status page exposed generic platform artwork rather than the monitored vendor's identity.

That result proved the build-time approach but was not visually strong enough to merge.

### Pass 2: official vendor website priority

Official vendor website overrides were added for known missing or generic hosted-status cases. The next GitHub-hosted build resolved 32 of 35 targets while the full test suite, typecheck, production build, provider validation, source quality checks, and dependency audit remained green.

### Pass 3: legacy ICO and pinned product artwork

Legacy ICO support restored Salesforce and similar vendor artwork. SuperOps and Cove Data Protection were moved to explicitly pinned official artwork so they did not depend on a generic hosted-status icon or missing website favicon. The resulting build resolved 34 of 35 targets and remained green. UltraDNS was the only unresolved provider.

### Pass 4: all-provider release gate

UltraDNS was given an explicit asset from its official documentation site and the release minimum was raised to 35 of 35. The first 35-of-35 run deliberately failed the build at 34 because the explicit UltraDNS documentation logo exceeded the general 64 KB favicon cap. All 335 tests and typecheck still passed. The failure confirmed the release gate prevents a normal letter tile from slipping through simply to obtain a green build.

The implementation was then refined so trusted, explicitly configured official assets use a separate 512 KB maximum while discovered favicons stay at 64 KB. The next CI run is the final merge gate for the full 35-of-35 policy.

## Release gate

Do not merge unless all repository checks are green and the GitHub-hosted application build reports:

`FAVICON_SYNC resolved=35 configured=35 minimum=35 failures=0`

After deployment, run the existing premium product-experience workflow and inspect both provider desktop and mobile screenshots. Structural verification alone is not sufficient. The visual acceptance criterion is that the formerly generated providers display recognizable real geometry and brand color rather than ordinary initial tiles.

## Bundle-size watchpoint

Embedding provider artwork inside the JavaScript bundle increased the application asset to slightly above Vite's default 500 KB warning threshold during the intermediate builds. This is acceptable for the current correctness and CSP-preserving recovery, but it should not become the long-term storage strategy if additional provider artwork is added.

The preferred follow-up is to emit generated artwork as local static files under the built application and keep only their local paths in the generated TypeScript manifest. That preserves the no-runtime-third-party contract while reducing JavaScript parse weight.

## Continuation point

After this change is deployed and visually verified:

1. Record the final merge SHA, deployment run, provider verification run, and screenshot evidence in this continuation stream.
2. Promote especially important providers from favicon recognition to pinned exact vector marks when official assets are available and licensing is clear.
3. Keep pinned official assets and vendor website favicons as the preferred long-tail recognition layer when a committed vector is unavailable.
4. Keep status-site favicons as a secondary fallback because hosted status platforms can expose generic artwork.
5. Move generated artwork out of the JavaScript bundle into local static files if bundle growth continues.
6. Keep the generated letter tile only as a runtime error and true unknown-provider fallback.
7. Record future provider identity source changes in `public/assets/logos/BRAND-SOURCES.md` and the relevant continuation record.
