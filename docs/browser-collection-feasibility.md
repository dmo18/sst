# Browser collection feasibility audit

## Decision

SST cannot replace generated `status.json` collection with browser-only collection while preserving the current Status Contract, all 80 providers, or a shared five-minute freshness objective. Keep GitHub Actions `*/5` collection as the canonical producer. The existing browser Statuspage overlay is the appropriate **non-blocking** hybrid: it can improve an open screen, but must not replace or rewrite the audited static payload.

This is an architecture finding, not a scheduler change. It adds no service, credential, VM process, or automation.

## Payload inventory and data boundary

`status.json` is intentionally public browser data. It contains no GitHub token, vendor credential, cookie, or raw authenticated source content. Its top-level fields at the 2026-09-02 audit were:

| Payload area | Fields | Classification |
| --- | --- | --- |
| Contract/publication | `contract_version`, `schema_version`, `catalog_hash`, `generated_at`, `status_data_policy` | browser-safe static metadata; collector generates its timestamp |
| Current state | `providers`, `incidents`, `maintenance`, `summary` | browser-safe normalized public result; Statuspage overlay can only refine a subset in memory |
| Collector telemetry | `collection` | public to read, server-derived run/origin/latency/coverage facts |
| Cross-run state | `history` and provider reliability/schema-canary fields | browser-safe to display, server-derived; needs the prior canonical snapshot |
| Change record | `changes` | browser-safe to display, server-derived comparison of current and prior canonical snapshots |

Every provider object exposes identity/context (`id`, `name`, `category`, `priority`, `criticality`, `tags`, `services`, `client_impact`, `technician_action`, `source`, `source_host`, `source_type`); normalized conclusions (`status`, `message`, `ok`, `color`, `service_state`, `attention`, `truth_basis`, `component_status`, incident/problem/maintenance counts); freshness/collection facts (`checked_at`, `last_success_at`, `freshness_seconds`, `freshness_state`, request/attempt/success/failure and latency fields, `download_log`); and quality/history facts (`status_data_valid`, `status_data_basis`, `evidence_tier`, `source_confidence`, `source_health`, `data_quality_score`, `consecutive_failures`, `last_semantic_change_at`, `source_reliability`, `schema_fingerprint`, `schema_changed`, `schema_canary`). Incident objects carry identity/provider/category, title/note, source/link, occurrence/update/observation times, status/color/service state, priority/attention, client/technician context, affected service, and updates. Maintenance objects carry equivalent identity/context/source/timing/state/note/priority/updates.

These are browser-safe outputs. The raw vendor documents, vendor adapters, sanitization, incident/maintenance reconciliation, prior-snapshot comparison, and reliability/schema calculation are server-only work. Moving it to each screen removes the shared audit trail and allows each display a different answer.

## All providers by collection contract

The 80-provider catalog observed in deployed Contract v3 is fully accounted for below. This is a collection-mode inventory, not a promise that any vendor will retain its current CORS policy.

| Collection mode | Count | Providers | Browser replacement disposition |
| --- | ---: | --- | --- |
| `statuspage-json` | 43 | `kaseya`, `barracuda`, `asana`, `discord`, `elastic-cloud`, `cloudflare`, `huntress`, `twilio`, `openai`, `sharefile`, `lumen`, `docusign`, `github`, `ninjaone`, `dnsfilter`, `sentinelone`, `1password`, `duo`, `meraki`, `ubiquiti`, `atera`, `eset`, `jumpcloud`, `lastpass`, `zoom`, `anthropic`, `addigy`, `godaddy`, `hubspot`, `jamf`, `knowbe4`, `linode`, `monday-com`, `nextiva`, `notion`, `quickbooks-online`, `shopify`, `stripe`, `vercel`, `digitalocean`, `wasabi`, `box`, `dropbox` | Candidate only for existing opportunistic overlay; not canonical replacement. |
| `status-html` | 19 | `cove-data-protection`, `salesforce`, `paypal`, `nuso`, `n-able`, `okta`, `ringcentral`, `sophos`, `bitdefender-gravityzone`, `bitwarden`, `cisco-umbrella`, `crashplan`, `fortinet`, `keeper`, `malwarebytes`, `proofpoint`, `syncro`, `xero`, `zendesk` | Server-only vendor HTML parsing/sanitization. |
| `feed` | 6 | `microsoft365`, `docker`, `aws`, `google-workspace`, `slack`, `google-cloud` | Server-only normalized feed parsing. |
| `status-access-reference` | 2 | `crowdstrike`, `intermedia` | Server-only limited/authenticated-reference semantics. |
| `statusio-html` | 2 | `connectwise`, `halopsa` | Server-only vendor parser. |
| `statusio-json` | 2 | `mimecast`, `ultradns` | Server-only vendor adapter and shared-history requirement. |
| `auth0-next-data` | 1 | `auth0` | Server-only adapter. |
| `azure-status-html` | 1 | `entra` | Server-only rendered official source. |
| `betterstack-json` | 1 | `superops` | Server-only adapter and shared-history requirement. |
| `firehydrant-json` | 1 | `backblaze` | Server-only adapter. |
| `statuscast-json` | 1 | `8x8` | Server-only adapter and shared-history requirement. |
| `vultr-json` | 1 | `vultr` | Server-only adapter. |

## Live CORS and rate-limit experiment

On 2026-09-02, a read-only unauthenticated GET probe issued one request per configured provider source with `Origin: https://dmo18.github.io`, four-way concurrency, an 80 ms inter-request pause per worker, redirects enabled, and a 10-second abort boundary. It recorded the response CORS and standard rate-limit/retry headers; it did not repeat failures.

| Result | Sources |
| --- | ---: |
| `Access-Control-Allow-Origin` allowed the deployed site or `*` | 49 |
| Successful HTTP response but no CORS grant | 24 |
| Connection failure or timeout at the 10-second boundary | 7 |
| HTTP 429 | 0 |
| Response advertising `Retry-After`, `RateLimit-*`, or `X-RateLimit-*` | 0 |

For the 43 Statuspage-mode sources, 34 granted CORS, two returned success without it (`docusign`, `lastpass`), and seven failed within the boundary (`box`, `discord`, `dropbox`, `jamf`, `knowbe4`, `linode`, `monday-com`). A GitHub Statuspage sample returned `200`, `Access-Control-Allow-Origin: *`, and `Cache-Control: max-age=10`.

This is compatibility evidence, not a vendor rate-limit promise: no vendor published an applicable rate header in this sample, and CORS can change without notice. Browser enforcement also includes SST's deliberately narrow CSP: the build grants `connect-src` only to configured official Statuspage origins, not arbitrary vendor URLs. Broadening it to the other 37 contracts expands browser attack and privacy surface without solving parsing, authentication, history, or freshness.

## Display compatibility and hybrid designs

The app builds for `chrome98`; the deployed release pipeline executes a pinned pre-cascade-layer Chromium wallboard test at 458x291 and a Yodeck geometry test. The static payload is therefore the compatible baseline. The overlay uses basic `fetch` with CORS, omitted credentials, a six-second timeout, concurrency eight, and non-blocking merge behavior. Failure leaves the verified static payload visible.

| Design | Outcome |
| --- | --- |
| Browser-only vendor aggregation | Rejected: 31 sources lacked a usable result in the experiment; 22 need HTML/rendered parsing, two are access references, and cross-run evidence disappears. |
| Static payload plus current Statuspage overlay | Retained: it preserves verified fallback and can improve currently CORS-readable Statuspage sources for an open browser. |
| Static shell with all vendor feeds in browser | Rejected: same CORS, parser, CSP, traffic/rate, and per-screen inconsistency failures. |
| Browser cache/service worker only | Rejected as scheduler replacement: it helps offline display but cannot collect unattended shared data. |
| GitHub Actions static collection | Retained canonical design: production-native and independent of Agent Deck/VM infrastructure. |

## Freshness conclusion and hard constraint

No VM or Agent Deck service participates in SST production. GitHub Actions is the only authorized canonical scheduler, with the intentional `*/5` normal path and bounded GitHub-native recovery bridge.

Neither browser-only collection nor GitHub-only scheduling can **guarantee** a canonical update within five minutes: a browser may be closed/offline, and a GitHub scheduled event or recovery dispatch can be delayed or fail. The bounded bridge limits recovery attempts and is not self-renewing. Meeting a hard ≤5-minute guarantee after both missed scheduling and failed dispatch requires an independently operated scheduler/queue or equivalent production service, which this audit was not authorized to add.

