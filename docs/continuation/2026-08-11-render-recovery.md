# Render recovery and continuation record

Date: 2026-08-11
Branch: `fix/render-recovery-2026-08-11`
Baseline: `main` at `8fe12300c4cb2bfdd8f9a9a36f62bf2bd3acceb8`

## Why this record exists

A build/verification sequence appeared to fail halfway through the responsive-shell work and the page was reported as visually broken. This document preserves the investigation, distinguishes confirmed failures from hypotheses, records the recovery implementation, and defines the continuation point so a later session does not need to rediscover the same evidence.

## Implementation stream being continued

The active product stream immediately before this recovery was:

1. Product-depth command system and operator experience.
2. Microsoft 365 critical coverage.
3. Provider identity recognition, including NUSO and locally bundled provider marks.
4. Responsive-shell hardening so desktop devices using browser zoom or OS display scaling do not fall into the compact phone shell.
5. Production render verification for desktop and mobile states.

Relevant merged milestones immediately before this recovery were PRs #130 through #133. The recovery must preserve those product-depth, Microsoft 365, provider-identity, NUSO, and responsive-shell outcomes rather than rolling them back wholesale.

## Evidence reviewed

### Repository and deployment

- GitHub Pages reports the site as built from `main` using the workflow deployment path.
- Deploy, CodeQL, and freshness workflows on the current baseline were successful.
- The premium product-experience workflow failed after the responsive-shell changes, but the deploy itself did not fail.

### Failed verification attempt

Premium product-experience run `31542629658`, first attempt, failed in `Verify deployed premium operator experience` before product assertions ran.

The uploaded verifier log ended with:

`Chrome DevTools endpoint did not become ready: fetch failed`

This established that the first workflow failure was a Chromium/CDP startup failure, not proof of a bad render.

### Verification rerun

The failed job was rerun without changing `main`. On the rerun, all substantive verification steps completed successfully:

- premium operator experience
- product-depth command system
- Microsoft 365 critical coverage
- provider identity and NUSO
- evidence upload

This confirms the original CI failure was transient infrastructure noise.

### Render evidence

A successful artifact from before the responsive-shell change was reviewed as a visual baseline. Fresh artifacts from the successful rerun were then reviewed for current `main`.

Current automated evidence reviewed:

- `operator-experience.png`: desktop shell is intact with the left navigation, desktop top bar, posture panel, metric grid, and operator queue.
- `operator-mobile.png`: compact phone shell is intact with mobile top controls, stacked metrics, and bottom navigation.
- The rerun also produced provider, product-depth, Microsoft 365, universe, incident, command, and search evidence.

The automated render is therefore not universally broken. The remaining defect is environment-sensitive and consistent with a startup race around the responsive-shell CSS guard.

## Root cause assessment

PR #132 introduced `keepDesktopDevicesOutOfCompactShell()` in `src/main.tsx`. Its purpose is valid: on a physical desktop wider than 900 device pixels, rewrite exact compact media queries such as `(max-width: 900px)` so browser zoom or OS scaling does not incorrectly activate the phone shell.

The risky part was timing. The function executed synchronously as soon as the module ran and immediately iterated `document.styleSheets`. Production CSS is emitted as stylesheets that can still be loading when the application module executes. If a stylesheet has not become readable yet, the code can miss its media rules and then mount React. That can leave a scaled desktop with a partial mixture of desktop and compact styles.

This explains why a normal automated render can pass while a particular scaled desktop can still look broken.

## Recovery implementation

The recovery keeps the scaled-desktop behavior but makes startup atomic:

1. `src/main.tsx` now waits for stylesheet links that are not ready yet.
2. A bounded 5-second timeout prevents an unavailable stylesheet from blocking startup forever.
3. The compact media-query rewrite runs only after that readiness phase.
4. React mounts only after the desktop-shell guard has completed.
5. The root element records `data-desktop-shell-guard` with the number of rewritten rules for future runtime diagnosis.
6. The existing provider/NUSO regression suite now verifies the ordering contract: stylesheet readiness, responsive rewrite, then application mount.

This is intentionally a focused recovery. It does not redesign the visual system or undo the completed premium/product-depth/provider work.

## Verification plan for this branch

Required before merge:

1. TypeScript/build verification must pass.
2. Existing provider identity and NUSO tests must pass, including the new atomic-startup assertions.
3. Existing premium/product-depth/Microsoft 365 tests must remain green.
4. After deployment, premium product-experience verification must produce both desktop and mobile evidence.
5. Inspect desktop, mobile, and provider screenshots for mixed-shell symptoms.
6. On a desktop using browser zoom or OS scaling that yields a CSS viewport below 900px, verify that the sidebar remains desktop-oriented and `data-desktop-shell-guard` is present.
7. On a real/mobile-emulated device at or below 900 device pixels, verify that the compact bottom-navigation shell still activates.

## Continuation point

Once this recovery is merged and production evidence remains green, continue the same implementation stream rather than starting a separate redesign.

Immediate next work:

1. Preserve the current premium operator, product-depth, Microsoft 365, provider identity, and NUSO behaviors as regression baselines.
2. Continue responsive hardening by moving the compact-shell device constraint from runtime CSSOM rewriting into author-time media-query contracts when the mobile CSS layers are next consolidated. That is a maintainability refactor, not a prerequisite for this recovery.
3. Extend production evidence to explicitly record the desktop-shell guard count and scaled-desktop geometry so future failures distinguish stylesheet readiness from layout assertion failures.
4. Keep every substantial recovery or implementation step documented under `docs/continuation/` with the baseline SHA, evidence, decisions, verification, residual risk, and next checkpoint.

## Residual risk

The recovery still uses CSSOM rewriting because that is the behavior established by PR #132 and verified by PR #133. Waiting for stylesheet readiness removes the identified race, but author-time guarded media queries would be simpler long-term. Do not remove the scaled-desktop contract until equivalent device-aware CSS is in place and verified on both real mobile and scaled desktop environments.
