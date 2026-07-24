# MSP Service Heads-Up Console

A static, official-source-only operations console for MSP technicians. It separates confirmed vendor service health from the reliability of the official source used to observe it. The browser loads only same-origin application assets and `status.json`; vendor retrieval occurs during GitHub Actions builds. There is no backend, database, credential, paid API, analytics, tracking, or unofficial outage feed.

Production: **https://dmo18.github.io/sst/**

## Operator mode

Operator mode is the detailed technician workspace. It retains search across providers, categories, tags, services and incident text; operational filters; expandable provider diagnostics and attempt logs; official links; MSP impact and technician guidance; incident history; and cautious, locally generated client communication drafts.

## Television wallboard

Wallboard mode is purpose-built for an unattended landscape display rather than a widened operator page. It uses the full safe viewport and has three explicit screens:

- **Heads Up:** overall service/source state, trustworthy coverage, high-visibility metrics, confirmed incidents, new/resolved changes, source gaps and highest-priority actions.
- **All Providers:** every enabled provider in controlled pages. Each tile has a bundled icon or deterministic local monogram, provider name, service state, source state, a non-color symbol and recent-change label.
- **Source Health:** paginated unavailable, limited, stale and disabled sources. It explicitly states that a source failure is not proof of a vendor outage.

Stable operational providers are omitted from the attention subset but remain available on All Providers. There is no auto-scroll. Page rotation is a hard transition, defaults to 30 seconds, is never faster than 20 seconds, can be paused, and is disabled by `rotate=0`. Reduced-motion users do not get automatic rotation. A critical incident keeps automatic rotation on Heads Up.

### Supported display matrix

The primary target is **1920×1080**, landscape, 100% zoom, DPR 1, fullscreen/kiosk. The layout also scales across **3840×2160** (DPR 1 or 2), **1366×768**, and **1280×720**. Operator targets are 1440×900, 1024×768, 768×1024 and a minimum width of 320px. Wallboard mode uses safe-area-aware padding to protect clocks and status labels from overscan. Set the television to “Just Scan”, “Screen Fit”, or the equivalent 1:1 mode and disable browser zoom.

### Bookmarked startup URLs

Query parameters override saved preferences; valid selections are persisted and reflected in the URL after interaction:

```text
?view=wallboard&screen=heads-up&rotate=30&density=comfortable
?view=wallboard&screen=providers&rotate=0&density=compact
?view=wallboard&screen=sources&rotate=30
?view=operator
```

Allowed screens are `heads-up`, `providers`, and `sources`; density is `comfortable` or `compact`; rotation is `0` or 20–300 seconds. Invalid values fall back safely. No secrets belong in these URLs.

### Fullscreen, kiosk, and display wake

Use **Full screen** or press `F` while focus is not in a form field. Escape exits fullscreen in normal browsers. Fullscreen is requested only after a gesture and unsupported browsers keep operating normally.

**Keep awake** uses the Screen Wake Lock API only after operator interaction, restores the lock when the tab becomes visible, persists the preference, and fails safely when unsupported or denied. Operating-system and television sleep, energy-saving and input-timeout settings may still need adjustment.

For a managed display, open the bookmarked wallboard URL in current Chrome or Edge at 100% zoom and use its supported fullscreen/kiosk policy. Example Chrome launch syntax is `chrome --kiosk "https://dmo18.github.io/sst/?view=wallboard&screen=heads-up&rotate=30"`. The application does not attempt to force kiosk mode.

## Freshness and status integrity

The browser polls deployed `status.json` once per minute while visible. The Pages workflow normally generates twice per hour. Wallboard data age is:

- **Normal:** under 40 minutes.
- **Warning:** 40–60 minutes.
- **Critical stale:** over 60 minutes.
- **Invalid:** unparseable or more than five minutes in the future.

The display continuously shows local time/date, generated time, last successful browser check, most recent failed check and data age. Stale incidents remain visible but are labeled stale; the frame receives persistent critical treatment; stale data is never presented as current operational confirmation.

Schema v2 states remain distinct:

- `service_state`: `operational`, `degraded`, `major`, `unknown`.
- `source_state`: `available`, `limited`, `unavailable`, `disabled`, `pending`, `stale`.
- `attention`: `critical`, `action`, `watch`, `informational`.

Unknown and limited are not operational. An unavailable source does not prove an outage. Disabled providers are excluded from enabled coverage. All generated and browser aggregates reconcile, malformed payloads are rejected, and the last valid payload remains visible after a refresh failure. “No confirmed active incidents” is scoped to confirmed coverage and never means unchecked providers are healthy.

### Safe schema transition

The browser accepts current schema-v2 payloads directly. During a deployment transition it can also migrate the previously deployed schema-v1 shape in memory, then run the complete schema-v2 validator before rendering. Legacy green values are deliberately converted to `service_state: unknown`—never operational—because the old contract did not prove explicit operational confirmation. Red and amber service signals remain major or degraded, while source reachability is migrated independently. Legacy data is never written back, and unsupported or malformed payloads are still rejected with actionable validation details. This prevents a newly deployed application bundle from showing an empty console while the first schema-v2 status generation is still deploying, without weakening the no-false-green contract.

## Development and deployment

Node 22+ is required.

```bash
npm ci
npm run validate-providers
npm test
npm run typecheck
npm run build:app
npm run update-status
npm run build
npm run preview
npm audit --audit-level=high
```

Tests are deterministic and do not contact vendors. The sole Pages workflow runs on `main`, manual dispatch and minutes 17/47. Its build job has only `contents: read`, performs one generation and one build, then uploads `dist`; the dependent deploy job alone receives `pages: write` and `id-token: write`.

### Deployment checklist

1. Run the deterministic checks and review the complete diff.
2. Run one live generation; confirm schema v2, 90 providers and reconciled counts without assuming all sources were reachable.
3. Confirm `dist/status.json`, `/sst/` asset paths and local icons.
4. Merge only after PR checks pass; confirm both Pages build and deploy jobs.
5. Open the production site and the three bookmarked wallboard screens at 1920×1080.

### Display troubleshooting

- **Blank display:** open browser developer tools or `https://dmo18.github.io/sst/status.json`; confirm it returns JSON with `schema_version: 2`, then verify the `/sst/` base path and Pages workflow.
- **Stale warning:** note generated and browser-check times, use **Check now**, verify network access to the same-origin JSON, then inspect the Pages Actions run.
- **No rotation:** confirm `rotate` is at least 20, press Resume, and check reduced-motion preferences. Use `rotate=0` to intentionally disable it.
- **Wrong mode:** use the Operator mode button or bookmark `?view=operator`.
- **Clipped edges:** disable TV overscan and keep browser zoom at 100%.
- **Display sleeps:** enable Keep awake if supported and adjust OS/TV power settings.

Microsoft 365 and Entra tenant-specific health remains limited because reliable detail requires authenticated Microsoft Graph service communications; this public static application deliberately accepts no credentials.
