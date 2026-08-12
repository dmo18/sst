# Provider logo recognition continuation record

Date: 2026-08-11
Original implementation branch: `fix/provider-logo-favicons`
Original baseline: `main` after render recovery merge `8cc2e21cd4cb0bf6dbe7a19e8b1450976750c22c`
Provider-artwork merge: `befceebc73363dc292cb94c560cc637b99d36d8e`
Static-artwork follow-up merge: `75a1dddc77591c34f21b326d0d1d828053ce98ac`

## Why this record exists

Provider identity was visually improved in the earlier product-depth work, but 35 canonical providers still used generated recognition tiles made from letters such as `S1`, `CW`, `HALO`, and `NUSO`. Those tiles were deterministic and colorful, but they were not sufficiently recognizable for fast operator scanning.

The requested outcome was provider marks that resemble the real service logos and colors, with official website favicons used as a practical long-tail source where a committed exact vector mark is not already available.

## Identity contract preserved

The implementation keeps the provider identity guarantees:

1. Existing committed exact vector and native local marks remain preferred.
2. The deployed browser does not load provider art from external domains at runtime.
3. NUSO remains a first-class canonical provider.
4. All normal provider artwork resolves from the deployed application origin.
5. The deterministic letter tile remains only as a defensive runtime decode fallback or true unknown-provider fallback, not the normal presentation for the 35 targeted providers.

## Final source hierarchy

The provider identity source order is:

1. Existing committed exact vector or native local mark.
2. Explicit pinned artwork from an official vendor or official product documentation site.
3. Favicon discovered from an explicit official vendor website override.
4. Favicon discovered from the provider's configured official status-site origin.
5. Deterministic provider-specific letter tile only if an already built identity unexpectedly cannot be decoded at runtime.

The source configuration lives in `config/provider-favicon-sources.json`. It names the exact 35 providers that previously depended on generated letter tiles and requires all 35 to resolve during a verified application build.

## Final build-time implementation

`scripts/sync-provider-favicons.mjs` runs as part of `npm run build:app` before Vite builds the application. For each configured provider it:

1. Reads the canonical provider catalog after consolidation.
2. Tries an explicit pinned official asset when one is configured.
3. Tries an explicit official vendor website when one is configured.
4. Falls back to the provider's official status-site origin derived from the configured public status source.
5. Inspects standard favicon and Apple touch icon declarations and conventional favicon paths.
6. Validates image media type and byte size.
7. Supports PNG, SVG, JPEG, GIF, WEBP, modern ICO files with embedded PNG frames, and legacy ICO files.
8. Wraps accepted artwork in a normalized local SVG container.
9. Writes each resolved provider mark as a SHA-named local SVG under `public/assets/logos/provider-favicons/` during the verified build.
10. Generates `src/generated/providerFavicons.ts` containing only local deployed asset paths.
11. Writes `public/assets/logos/provider-favicon-sources.json` with source kind, page, resolved asset URL, media type, size, digest, and generated filename.

Discovered favicons remain capped at 64 KB. Explicitly pinned official assets use a separate 512 KB ceiling. This permits a documented vendor or product logo to be used without weakening the size limit applied to arbitrary favicon discovery.

The generated `public/assets/logos/provider-favicons/` directory is ignored by source control because it is deterministic build output rather than hand-maintained source artwork.

## Runtime behavior

`src/providerIcon.tsx` checks the generated provider-artwork map before falling back to the pre-existing recognition tile for the formerly generated provider set. Exact committed brand-mask and native assets continue through their existing paths.

The generated map now points to same-origin local static SVG assets. The browser does not contact the provider, a logo CDN, or a favicon service. Real fetched artwork is rendered with `provider-logo--favicon`. `provider-logo--generated` is reserved for the emergency letter fallback so production verification can distinguish a real provider mark from a fallback tile.

If a local built artwork file unexpectedly cannot decode, the deterministic provider-specific tile is used as an emergency presentation fallback.

## Regression coverage

`scripts/__tests__/provider-favicon-sync.test.js` covers:

1. Exact coverage of all 35 formerly generated recognition brands.
2. A required `minimumResolved` value of 35.
3. Vendor website and official asset override configuration.
4. Status-site origin derivation.
5. Favicon link discovery and conventional fallback paths.
6. Image normalization and static SVG wrapping.
7. Legacy ICO support.
8. Product-specific background plates for reversed artwork.
9. Separate 64 KB discovered-icon and 512 KB pinned-official-asset ceilings.
10. Provider UI preference for the build-generated local artwork map.
11. Presence of the artwork sync step in the application build command.
12. No runtime external image URL added to `src/providerIcon.tsx`.
13. Static provider-artwork output under `assets/logos/provider-favicons/` rather than JavaScript image data.

The provider identity browser verifier additionally requires:

- 35 fetched favicon or official-artwork identities;
- zero normal generated fallback tiles;
- zero embedded provider SVG data URIs;
- at least 45 exact committed local logo references;
- all 80 provider identities resolving through local application assets;
- no external logo origin;
- successful loading of every referenced local artwork file;
- NUSO visible in the retained mobile provider frame.

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

The implementation was refined so trusted, explicitly configured official assets use a separate 512 KB maximum while discovered favicons stay at 64 KB. UltraDNS was ultimately sourced from its official management portal favicon, which preserved a recognized browser image format and the all-provider release gate.

### Pass 5: production provider-artwork release

PR #135 merged as `befceebc73363dc292cb94c560cc637b99d36d8e`.

Production release run `31552986038` succeeded with:

`FAVICON_SYNC resolved=35 configured=35 minimum=35 failures=0`

The post-deploy product-experience run `31553086715` also succeeded, including provider identity and NUSO verification. Retained artifact `9124977352` provided the desktop and mobile provider screenshots used for direct visual acceptance.

### Pass 6: static local artwork follow-up

The first correct implementation embedded the 35 wrapped artwork files inside JavaScript. It pushed the main application chunk to 535.23 KB and triggered Vite's default large-chunk warning. The continuation record explicitly identified same-origin static artwork as the preferred next architecture.

PR #136 completed that follow-up rather than suppressing the warning:

- generated provider artwork moved to local static SVG files under `public/assets/logos/provider-favicons/`;
- the generated TypeScript map now contains local paths only;
- the release gate remained 35 of 35;
- normal generated letter fallbacks are now independently measurable and required to be zero in production verification;
- the main JavaScript chunk dropped from 535.23 KB to 384.03 KB;
- Vite's previous greater-than-500-KB warning disappeared without raising the warning threshold.

PR #136 pull-request checks run `31554417315` and CodeQL run `31554417343` both succeeded. It merged as `75a1dddc77591c34f21b326d0d1d828053ce98ac`. Production release #845, run `31554526482`, and product-experience run #46, `31554618865`, succeeded with the static-artwork architecture active.

## Current release gate

Do not merge provider identity changes unless all repository checks are green and the GitHub-hosted application build reports:

`FAVICON_SYNC resolved=35 configured=35 minimum=35 failures=0`

After deployment, the provider identity verifier must confirm 35 real fetched marks, zero normal generated fallback tiles, no embedded provider image data, no external provider artwork origins, and successful same-origin asset loads. Desktop and mobile provider screenshots must still be reviewed directly because recognizability remains a visual requirement rather than only an asset-count requirement.

## Bundle-size follow-up status

Completed by PR #136.

The earlier watchpoint is no longer outstanding. Provider artwork is emitted as same-origin local static files and JavaScript contains only local paths. The verified PR #136 build reduced the main JavaScript chunk from 535.23 KB to 384.03 KB and removed the default Vite large-chunk warning without changing the warning threshold.

Future provider additions should preserve this architecture rather than returning to embedded artwork data.

## Continuation point

For future provider identity work:

1. Preserve the 35-of-35 build requirement for the existing formerly generated set unless the canonical catalog changes deliberately.
2. Promote especially important providers from favicon recognition to pinned exact vector marks when official assets are available and licensing is clear.
3. Keep pinned official assets and vendor website favicons as the preferred long-tail recognition layer when a committed vector is unavailable.
4. Keep status-site favicons as a secondary fallback because hosted status platforms can expose generic artwork.
5. Keep generated artwork as local static build output rather than JavaScript-embedded image data.
6. Keep the generated letter tile only as a runtime error and true unknown-provider fallback.
7. Record future provider identity source changes in `public/assets/logos/BRAND-SOURCES.md` and the relevant continuation record.
