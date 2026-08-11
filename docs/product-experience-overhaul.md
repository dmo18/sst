# Premium SaaS product experience overhaul

Status: implementation in progress
Started: 2026-08-10
Base commit: `c6118a2951993fc92df29b781989397e78801f5e`
Pull request: #114

## Why this exists

The architecture and truth model are now strong, but the operator experience still presented too much like a dense internal admin dashboard. A production SaaS command center must do more than expose correct data. It must establish hierarchy immediately, communicate posture at a glance, reward exploration, make frequent actions effortless, and feel intentional at every interaction boundary.

This pass is evaluated as product design, not infrastructure cleanup or a color-theme exercise.

## Experience principles

1. **Signal before inventory** - the first screen should explain what matters before asking the operator to read tables.
2. **Command, do not browse** - frequent navigation and refresh actions should be reachable from a keyboard-first command layer.
3. **Confidence has a visual language** - service impact, source uncertainty, freshness, and reliability should feel related without being conflated.
4. **Atmosphere with restraint** - depth, glow, blur, motion, and gradients should communicate a premium live system without becoming decorative noise.
5. **Progressive disclosure** - overview first, then evidence and detail. Dense diagnostics belong behind deliberate interaction boundaries.
6. **Operational motion** - motion is used for state transitions, focus, and live affordances, and must honor reduced-motion preferences.
7. **Wallboard is a product surface** - signage should share the same premium identity while preserving exact Yodeck geometry and legacy-browser fallback behavior.
8. **Mobile is not a compressed desktop** - phone navigation, cards, drawers, density, and fixed controls have an explicit product contract.
9. **No truth-model compromise** - visual polish must never blur the difference between vendor service health, source trust, parser state, and collection quality.

## Current implementation

### Premium visual system

The operator shell now uses a deliberate product language instead of the prior flat panel/table styling:

- deep near-black atmospheric canvas with restrained blue, violet, cyan, green, amber, and red energy;
- glass-like elevated surfaces with stronger separation, larger radii, and a coherent shadow hierarchy;
- substantially larger typography and more decisive information hierarchy;
- state-aware treatments for critical, warning, positive, and neutral operating posture;
- spacious overview hero designed to read as a live command center rather than a dashboard title card;
- premium metric cards, tables, filters, incident records, provider drawer, empty states, and intelligence surfaces;
- tactile hover, focus, press, drawer, and surface-entry behavior;
- consistent custom scrollbars and high-visibility keyboard focus rings;
- global reduced-motion handling.

`src/styles/premium-state.css` makes the surrounding atmosphere respond subtly to the current trusted operating posture. Critical, warning, healthy, and not-yet-ready states influence ambient energy and hero treatment without changing the semantic service-health colors or creating additional health conclusions.

### Product identity

The boxed letter mark and visible Unicode navigation characters were prototype artifacts. `src/styles/premium-icons.css` replaces them with a simple abstract product mark and one coherent dependency-free masked icon family for Overview, Incidents, Providers, Sources, and Timeline.

This avoids a new icon package and keeps the static Pages application self-contained.

### Command experience

`src/ExperienceLayer.tsx` adds a keyboard-first command surface without duplicating the underlying navigation state.

- `Command/Ctrl + K` opens the launcher.
- The displayed launcher shortcut adapts to Mac versus Windows/Linux.
- Existing canonical shortcuts remain the execution contract for overview, incidents, providers, sources, timeline, wallboard, and refresh.
- Up/Down changes the selected command and Enter runs the highlighted command.
- Mouse hover and keyboard selection remain synchronized through one active-command state.
- A persistent live-pulse dock summarizes current operating posture using the same trusted model as the console.
- The command launcher promotes up to four current incident signals ahead of generic navigation so it behaves as an operational tool, not a static menu.
- The launcher exposes live incident, blind-spot, and coverage context.
- Refresh and incident command actions provide brief operator acknowledgement.

### Mobile command center

`src/styles/premium-mobile.css` is an authoritative mobile layer loaded after the desktop premium styles.

At 900px and below it preserves and upgrades the purpose-built mobile operating model:

- fixed five-destination bottom navigation;
- icon-first compact tabs with current-state emphasis;
- sticky glass topbar and lifecycle strip;
- two-column metric cards;
- provider rows converted to touch-friendly cards;
- incident and timeline records converted to phone-native layouts;
- full-screen provider detail drawer;
- compact responsive hero and page summaries;
- safe-area-aware bottom spacing;
- desktop pulse dock collapsed so it cannot fight the mobile bottom navigation.

### Wallboard identity

`src/styles/wallboard-premium.css` adds visual polish only. It intentionally avoids changing wallboard dimensions, layout, font sizing, overflow, or marquee timing. Geometry remains owned by the existing normal, compatibility, and TV stylesheets.

The premium wallboard treatment adds:

- atmospheric background depth;
- improved surface separation;
- cleaner telemetry contrast;
- provider and incident emphasis;
- service-impact tinting;
- subtle icon and control depth.

The exact 458 by 291 Yodeck contract and pre-cascade-layer compatibility path remain blocking release gates.

### Product-surface release evidence

`scripts/verify-operator-experience.mjs` uses current Chromium through CDP after a successful production deployment. It does not merely check for text in the DOM.

The verifier requires:

- a 1440 by 960 desktop viewport;
- the enterprise shell, premium posture hero, premium design tokens, and state-aware atmosphere;
- a desktop sidebar wide enough to preserve the product composition;
- a materially larger posture headline and hero treatment;
- no horizontal viewport overflow;
- the live command affordance;
- the command palette to open with its search input focused;
- at least the seven canonical commands;
- ArrowDown to move the selected command in the real browser;
- a 390 by 844 mobile viewport;
- fixed five-destination bottom navigation at the viewport edge;
- the premium mobile hero and operational atmosphere;
- no mobile horizontal overflow;
- the desktop pulse dock to be collapsed on phone.

The verifier captures three production screenshots: desktop overview, open command palette, and mobile operator view.

`.github/workflows/product-experience.yml` runs this proof after successful code-changing or manually dispatched production releases and retains the HTML plus all three screenshots for fourteen days. It intentionally skips ordinary scheduled data-refresh releases because they reuse an already-verified application shell and contain no product-code change.

## Completion gate

This product-experience pass is complete only when:

1. provider validation, quality, deterministic tests, TypeScript, production build, dependency audit, and CodeQL are green;
2. the operator application renders with the premium experience layer and live command launcher;
3. keyboard selection, canonical navigation, and refresh actions remain functional;
4. loading, stale, unavailable, empty, incident, source-risk, and healthy states remain legible;
5. current-browser production smoke passes;
6. the pre-cascade-layer wallboard runtime still passes;
7. exact 458 by 291 Yodeck verification passes without geometry regressions;
8. the post-deploy product-surface workflow passes desktop, command-palette, and mobile browser assertions and publishes its evidence artifact;
9. the final visual state is deployed to production before this document is marked complete.
