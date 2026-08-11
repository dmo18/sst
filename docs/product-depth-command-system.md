# Product-depth command system

Status: implementation in progress
Started: 2026-08-11
Base: `f9a8d62d8fcfa32f9fb77852103ac4d208fc36be`

## Why this phase exists

The premium visual redesign fixed product presentation but did not yet create enough product depth. ServiceOps still behaved primarily as a polished monitoring console: operators could inspect, navigate, filter, and copy information, but the application did not provide a strong browser-local action loop, a memorable dependency exploration surface, universal search, explicit catch-up intelligence, or reusable personal lenses.

This phase addresses that gap without pretending the current static GitHub Pages architecture has a shared server-side collaboration backend.

## Product contract

### Operator workflow state

ServiceOps may store browser-local operator workflow state for convenience:

- acknowledgement;
- follow state;
- 30-minute snooze;
- locally handled state;
- local assignee text;
- local operator notes;
- pinned providers;
- saved provider lenses;
- last explicitly reviewed payload.

This state is never vendor truth. It must not alter `service_state`, `source_state`, `source_health`, evidence, source confidence, parser state, or release validation. The UI labels the state as browser-local and handoff exports state the same boundary explicitly.

### Incident Focus

An active incident can open a dedicated incident room containing:

- vendor incident identity and priority;
- vendor timeline;
- MSP impact and technician guidance;
- client-safe draft;
- source trust, evidence tier, and quality;
- cautious temporal correlation context;
- browser-local acknowledgement/follow/snooze/handled workflow;
- assignee and notes;
- copyable operator handoff bundle;
- shareable deep link.

### Dependency Universe

The signature product surface is an interactive dependency field:

- service categories act as gravity hubs;
- monitored providers orbit their category;
- service/source posture drives node tone;
- high-criticality, affected, pinned, and replayed nodes receive stronger visual treatment;
- cautious vendor-timed correlations become distinct edges;
- correlation language remains temporal only and never claims causality;
- saved lenses can isolate a selected provider estate.

### Signal Replay

Replay uses bounded recorded `StatusChange` history only. It highlights recorded provider changes over time. It does not reconstruct historical service state that was never observed and must say so in the product.

### Universal search

Command/Ctrl + Shift + K searches one index spanning:

- active incidents;
- providers;
- maintenance;
- temporal correlations;
- service categories;
- bounded change history.

Search results open shareable investigation targets rather than merely filtering the current table.

### What changed

The product compares bounded recorded changes against the last payload the operator explicitly marked as reviewed and summarizes:

- new incidents;
- recoveries;
- source changes;
- maintenance changes;
- severity changes.

No hidden or unobserved event is inferred.

### Personal lenses

Operators can pin providers and save the pinned set as a named browser-local lens. A lens can be opened directly in Dependency Universe and carried in the URL by lens identifier.

## Discoverability

The command system is accessible through all of the following:

- persistent Dependency Universe application-chrome launcher;
- `G` keyboard shortcut;
- existing Command/Ctrl + K palette;
- Command/Ctrl + Shift + K universal search;
- live incident commands that open Incident Focus directly;
- shareable `focus=` and `lens=` URL state.

## Static-product boundary

This repository remains a public static GitHub Pages application. This phase does not fake shared team state, authentication, server-side comments, external ticket creation, Slack/Teams delivery, PagerDuty actions, or PSA writes. Those require an authenticated backend and explicit private-data architecture. Browser-local state is intentionally labeled and isolated from the public status contract.

## Completion gate

This phase is complete only when:

1. deterministic tests and TypeScript pass;
2. existing provider, status, release, security, wallboard, and product-experience contracts remain green;
3. CodeQL is green;
4. production current-Chromium verification passes;
5. pinned pre-Cascade-Layers Chromium wallboard verification passes;
6. exact 458x291 Yodeck verification passes;
7. deployed product-experience verification exercises Dependency Universe, universal search, Incident Focus, desktop, and mobile without horizontal overflow;
8. screenshots are manually reviewed and visible product defects are fixed before closure;
9. documentation records the exact production and evidence runs.
