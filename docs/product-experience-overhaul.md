# Premium SaaS product experience overhaul

Status: implementation in progress
Started: 2026-08-10
Base commit: `c6118a2951993fc92df29b781989397e78801f5e`

## Why this exists

The architecture and truth model are now strong, but the operator experience still presents too much like a dense internal admin dashboard. A production SaaS command center must do more than expose correct data. It must establish hierarchy immediately, communicate posture at a glance, reward exploration, make frequent actions effortless, and feel intentional at every interaction boundary.

This pass is evaluated as product design, not infrastructure cleanup.

## Experience principles

1. **Signal before inventory** - the first screen should explain what matters before asking the operator to read tables.
2. **Command, do not browse** - frequent navigation and refresh actions should be reachable from a keyboard-first command layer.
3. **Confidence has a visual language** - service impact, source uncertainty, freshness, and reliability should feel related without being conflated.
4. **Atmosphere with restraint** - depth, glow, blur, motion, and gradients should communicate a premium live system without becoming decorative noise.
5. **Progressive disclosure** - overview first, then evidence and detail. Dense diagnostics belong behind deliberate interaction boundaries.
6. **Operational motion** - motion is used for state transitions, focus, and live affordances, and must honor reduced-motion preferences.
7. **Wallboard is a product surface** - signage should share the same premium identity while preserving exact Yodeck geometry and legacy-browser fallback behavior.
8. **No truth-model compromise** - visual polish must never blur the difference between vendor service health, source trust, parser state, and collection quality.

## Current implementation

### Premium visual system

- Deep near-black atmospheric canvas with restrained blue/violet/cyan depth.
- Glass-like elevated surfaces with stronger separation, larger radii, and more intentional shadow hierarchy.
- Larger typography and substantially stronger heading hierarchy.
- State-aware accent treatments for critical, warning, positive, and neutral operational posture.
- Spacious overview hero designed to read like a command center rather than a dashboard title card.
- Premium metric cards, tables, filters, incident records, provider drawer, and intelligence panel.
- Responsive density changes for tablet and mobile.
- Global reduced-motion handling.

### Command experience

`src/ExperienceLayer.tsx` adds a keyboard-first command surface without duplicating the underlying navigation state.

- `Command/Ctrl + K` opens the launcher.
- Existing canonical shortcuts remain the execution contract for overview, incidents, providers, sources, timeline, wallboard, and refresh.
- A persistent live-pulse dock summarizes the current operating posture using the same trusted model as the console.
- The launcher exposes live incident, blind-spot, and coverage context.
- Refresh requests produce a brief operator acknowledgement.

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

## Completion gate

This product-experience pass is complete only when:

1. provider validation, quality, deterministic tests, TypeScript, production build, dependency audit, and CodeQL are green;
2. the operator application renders with the premium experience layer and command launcher;
3. keyboard navigation and refresh actions remain functional;
4. loading, stale, unavailable, empty, incident, source-risk, and healthy states remain legible;
5. current-browser production smoke passes;
6. the pre-cascade-layer wallboard runtime still passes;
7. exact 458 by 291 Yodeck verification passes without geometry regressions;
8. the final visual state is deployed to production before this document is marked complete.
