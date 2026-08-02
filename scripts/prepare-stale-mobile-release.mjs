import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

execFileSync('npm', ['version', '3.3.0', '--no-git-tag-version'], { stdio: 'inherit' });
const path = 'CHANGELOG.md';
const text = fs.readFileSync(path, 'utf8');
const marker = '## [3.2.0] - 2026-08-02';
const entry = `## [3.3.0] - 2026-08-02

### Fixed

- Rejected unresolved incident records when the official source has not published current evidence within 45 days, while retaining long-running incidents that have a recent vendor update.
- Prevented date-only lines and status-update timestamps from becoming incident titles.
- Corrected Cisco Umbrella parsing for spaced date punctuation and expanded international-region filtering for Dubai, Mumbai, Hyderabad, and Delhi.
- Removed malformed date-title events from the active payload and retained audit history.
- Changed ambiguous stale incident records to limited/unknown rather than presenting them as current incidents or confirmed healthy service.

### Mobile operations experience

- Replaced the wrapped horizontal desktop navigation with a fixed five-destination bottom navigation designed for phones.
- Added a compact sticky mobile header and lifecycle strip so operational content appears immediately.
- Replaced horizontally scrolling provider tables with touch-friendly provider summary cards.
- Reworked KPI, action queue, category, incident, maintenance, timeline, provider drawer, filter, and safe-area layouts for 360px, 390px, and 430px phone widths.
- Preserved continuously updating payload age, browser refresh countdowns, observation ages, source state, and fail-closed semantics.

`;
if (!text.includes(marker)) throw new Error('3.2.0 changelog marker missing');
fs.writeFileSync(path, text.replace(marker, entry + marker));
