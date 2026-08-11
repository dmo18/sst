# Architecture overhaul historical record

Status: superseded by the full architecture reconciliation
Initial pass started: 2026-08-10
Initial pass closed: 2026-08-10

This file records the first four implementation phases of the 2026-08-10 architecture overhaul. That first pass corrected major correctness, provenance, release, security, and operations-intelligence issues, but it was later determined to have closed against a reduced scope. It is therefore retained only as historical evidence.

The authoritative final implementation record is [architecture-reconciliation.md](architecture-reconciliation.md). That reconciliation reopens the original review backlog and approved next-level architecture requirements, including the items that this first pass did not complete.

## Historical phase evidence

| Phase | Pull request | Merge commit | Production proof |
|---|---:|---|---|
| Correctness and contract convergence | #98 | `ab94fe5acc1039ec4830b0f43dd520614232026a` | run #780, successful |
| Collector and provenance cleanup | #99 | `b3bd4cf8d0c368a9113a54b6a043a5f6398d8044` | run #782, successful |
| Pipeline and security hardening, first pass | #100 | `4123914b405d84478a30deb68e4c24f1eb39d3cf` | run #784, successful |
| Operations intelligence, first pass | #109 | `31ce6b7044bca7530827f94a33054a0f29137be9` | run #785, successful |
| Premature first-pass closure | #110 | `82bc6cf3df4a65d2dc3adb43885b04f5aafcd2ee` | run #786, successful |

## What the first pass successfully established

- Canonical current-page incident timing and provenance, including `observed_at` and `evidence_basis`.
- Authoritative browser-check telemetry, bounded payload retrieval, and visibility-resume recovery.
- Shared component-health semantics and canonical provider identity validation.
- Stable fallback incident identity and removal of the RingCentral postprocessor.
- Shared release-contract verification and cleaner collection timing semantics.
- A smaller production status core separated from the archived legacy parser monolith.
- Token-free sandboxed vendor-page collection, immutable action references, full dependency audit, and Dependabot.
- Initial seven-day source reliability, parser schema canaries, and cautious vendor-timed event correlation.
- Preservation of the 180-second wallboard browser cadence, 60-second operator cadence, URL-bounded wallboard refresh override, serialized Pages release path, and exact 458 by 291 Yodeck production verification.

## Why the record was superseded

The first-pass closure did not complete several approved requirements. The missing or partial work included the explicit Status Contract v3 public envelope, canonical catalog hash, formal source-adapter SDK boundary, extracted `usePayloadPoller`, thirty-day reliability, active parser quarantine semantics, CSP, CodeQL, current action runtime generations, repository lint/format/hook gates, derived provider counts, a real pinned legacy-browser runtime check, and scheduled reuse of a verified immutable application shell.

Those requirements are implemented and verified under [architecture-reconciliation.md](architecture-reconciliation.md). Do not use this historical file to determine whether the final architecture overhaul is complete.
