import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('production HTML does not load a legacy wallboard DOM controller', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /wallboard-controls\.js/);
  assert.equal((html.match(/<script\b/g) || []).length, 1, 'only the Vite module entry should execute');
});

test('Pages deployment is serialized, fully validated, and bounded', async () => {
  const workflow = await read('.github/workflows/refresh-pages.yml');
  assert.match(workflow, /concurrency:\s*\n\s*group:\s*pages-release\s*\n\s*cancel-in-progress:\s*false/);
  assert.match(workflow, /build:\s*[\s\S]*timeout-minutes:\s*20/);
  assert.match(workflow, /deploy:\s*[\s\S]*timeout-minutes:\s*20/);
  assert.doesNotMatch(workflow, /Cancel superseded Pages deployment/);
  assert.doesNotMatch(workflow, /github\.event_name != 'schedule'/);
  assert.match(workflow, /name:\s*Run deterministic tests[\s\S]*run:\s*npm test/);
  assert.match(workflow, /name:\s*Run TypeScript checking[\s\S]*run:\s*npm run typecheck/);
  assert.match(workflow, /name:\s*Audit production dependencies[\s\S]*run:\s*npm audit --audit-level=high/);
  assert.match(workflow, /uses:\s*actions\/deploy-pages@v4\s*\n\s*with:\s*\n\s*timeout:\s*600000/);
  assert.match(workflow, /name:\s*Verify 458x291 Yodeck wallboard contract/);
  assert.match(workflow, /--window-size=458,291/);
  assert.match(workflow, /view=wallboard&alerts=36h&layoutProbe=yodeck/);
  assert.match(workflow, /data-layout-probe="pass"/);
});

test('freshness recovery never dispatches over an active release', async () => {
  const workflow = await read('.github/workflows/status-freshness-watch.yml');
  assert.match(workflow, /actions\/workflows\/refresh-pages\.yml\/runs\?per_page=20/);
  assert.match(workflow, /new Set\(\['queued', 'in_progress', 'waiting', 'requested', 'pending'\]\)/);
  assert.match(workflow, /steps\.freshness\.outputs\.stale == 'true' && steps\.release\.outputs\.active == 'true'/);
  assert.match(workflow, /steps\.freshness\.outputs\.stale == 'true' && steps\.release\.outputs\.active != 'true'/);
  assert.match(workflow, /group:\s*status-freshness-watch\s*\n\s*cancel-in-progress:\s*false/);
});

test('wallboard visibility uses explicit automatic and manual states', async () => {
  const css = await read('src/styles/wallboard-focus.css');
  assert.match(css, /\.wallboard-shell\.wallboard-controls-visible\s*>\s*header/);
  assert.match(css, /\.wallboard-shell\.wallboard-controls-visible\s*>\s*\.wallboard-kpis/);
  assert.match(css, /\.wallboard-shell\.wallboard-controls-pinned-open\s*>\s*header/);
  assert.match(css, /\.wallboard-shell\.wallboard-controls-pinned-closed\s*>\s*header/);
  assert.doesNotMatch(css, /\.wallboard-shell:hover/);
  assert.doesNotMatch(css, /data-header-collapsed/);
});

test('wallboard header and KPI strip have separate fixed geometry', async () => {
  const css = await read('src/styles/wallboard-focus.css');
  assert.match(css, /--wallboard-header-height:\s*72px/);
  assert.match(css, /--wallboard-kpi-height:\s*88px/);
  assert.match(css, /top:\s*calc\(var\(--wallboard-overlay-inset\) \+ var\(--wallboard-header-height\) \+ var\(--wallboard-overlay-gap\)\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
});

test('freshness telemetry is inline with the priority heading', async () => {
  const source = await read('src/wallboardDomEnhancements.ts');
  const css = await read('src/styles/wallboard-focus.css');
  assert.match(source, /\.wallboard-priority > h2/);
  assert.match(source, /heading\.appendChild\(telemetry\)/);
  assert.match(css, /\.wallboard-priority\s*>\s*h2[\s\S]*display:\s*flex/);
  assert.doesNotMatch(css, /\.wallboard-mini-telemetry[\s\S]*position:\s*fixed/);
});

test('the remaining wallboard enhancement never mutates signal rows', async () => {
  const source = await read('src/wallboardDomEnhancements.ts');
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /querySelectorAll[^\n]*article/);
  assert.doesNotMatch(source, /appendChild\(item\.article\)/);
  assert.doesNotMatch(source, /\.hidden\s*=/);
});

test('compact wallboard uses absolute viewport geometry and cannot collapse', async () => {
  const css = await read('src/styles/wallboard-v2.css');
  assert.match(css, /@media \(max-width: 1180px\), \(max-height: 520px\)/);
  assert.match(css, /\.wallboard-v2\s*\{[\s\S]*display:\s*block\s*!important/);
  assert.match(css, /\.wallboard-v2 > main\s*\{[\s\S]*position:\s*absolute\s*!important[\s\S]*inset:\s*6px\s*!important/);
  assert.match(css, /\.wallboard-v2 \.wallboard-priority-v2\s*\{[\s\S]*position:\s*absolute[\s\S]*inset:\s*0/);
  assert.match(css, /\.wallboard-v2 \.wallboard-providers,[\s\S]*\.wallboard-v2 > footer[\s\S]*display:\s*none\s*!important/);
});

test('wallboard priority list uses a seamless continuous marquee even on reduced-motion TVs', async () => {
  const source = await read('src/WallboardV2.tsx');
  const css = await read('src/styles/wallboard-v2.css');
  const priorityMarquee = source.match(/function usePriorityMarquee[\s\S]*?(?=function useProviderMarquee)/)?.[0] || '';

  assert.match(source, /item\.kind === 'incident'/);
  assert.match(source, /wallboard-priority-track/);
  assert.match(source, /wallboard-priority-copy/);
  assert.match(source, /--wallboard-loop-distance/);
  assert.match(source, /--wallboard-loop-duration/);
  assert.match(source, /ResizeObserver/);
  assert.doesNotMatch(priorityMarquee, /prefers-reduced-motion|reducedMotion/);
  assert.doesNotMatch(source, /setInterval\([^\n]*scroll|scrollTo|scrollTop|CAROUSEL_STEP_MS/);
  assert.match(css, /@keyframes wallboard-priority-marquee/);
  assert.match(css, /animation:\s*wallboard-priority-marquee var\(--wallboard-loop-duration\) linear infinite/);
  assert.match(css, /translate3d\(0, calc\(-1 \* var\(--wallboard-loop-distance\)\), 0\)/);
  assert.match(css, /wallboard-priority-track:not\(\.is-looping\) \.wallboard-priority-copy/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*wallboard-priority-track\.is-looping[\s\S]*linear infinite !important/);
  assert.doesNotMatch(css, /wallboard-priority-track\.is-looping\s*\{\s*animation:\s*none/);
  assert.doesNotMatch(css, /-webkit-line-clamp:\s*2/);
});

test('compact wallboard continuously loops labeled alert provider chips whenever needed', async () => {
  const source = await read('src/WallboardV2.tsx');
  const css = await read('src/styles/wallboard-v2.css');
  const providerMarquee = source.match(/function useProviderMarquee[\s\S]*?(?=function rectsOverlap)/)?.[0] || '';

  assert.match(source, /useProviderMarquee/);
  assert.match(source, /wallboard-alert-provider-track/);
  assert.match(source, /wallboard-alert-provider-copy/);
  assert.match(source, /--wallboard-provider-loop-distance/);
  assert.match(source, /--wallboard-provider-loop-duration/);
  assert.match(source, /groupWidth > viewport\.clientWidth \+ 2/);
  assert.match(source, /<b>\{item\.provider\}<\/b>/);
  assert.match(source, /const seen = new Set<string>\(\)/);
  assert.doesNotMatch(providerMarquee, /prefers-reduced-motion|reducedMotion/);
  assert.match(css, /@keyframes wallboard-alert-provider-marquee/);
  assert.match(css, /animation:\s*wallboard-alert-provider-marquee var\(--wallboard-provider-loop-duration\) linear infinite/);
  assert.match(css, /translate3d\(calc\(-1 \* var\(--wallboard-provider-loop-distance\)\), 0, 0\)/);
  assert.match(css, /wallboard-alert-provider-track:not\(\.is-looping\) \.wallboard-alert-provider-copy/);
  assert.match(css, /\.wallboard-v2 \.wallboard-alert-provider-chip\s*\{[\s\S]*display:\s*inline-flex/);
  assert.match(css, /\.wallboard-v2 \.wallboard-alert-provider-chip b\s*\{[\s\S]*text-overflow:\s*ellipsis/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*wallboard-alert-provider-track\.is-looping[\s\S]*linear infinite !important/);
});

test('the 458x291 production probe checks compact geometry, filtering, and marquee state', async () => {
  const source = await read('src/WallboardV2.tsx');
  const workflow = await read('.github/workflows/refresh-pages.yml');

  assert.match(source, /const YODECK_WIDTH = 458/);
  assert.match(source, /const YODECK_HEIGHT = 291/);
  assert.match(source, /layoutProbe.*yodeck/);
  assert.match(source, /heading-overlaps-provider-rail/);
  assert.match(source, /provider-rail-overlaps-list/);
  assert.match(source, /header-overlay-obscures-content/);
  assert.match(source, /kpi-overlay-obscures-content/);
  assert.match(source, /alerts-outside-window/);
  assert.match(source, /priority-marquee-not-running/);
  assert.match(source, /provider-marquee-not-running/);
  assert.match(source, /shell\.dataset\.layoutProbe = reasons\.length \? 'fail' : 'pass'/);
  assert.match(workflow, /--window-size=458,291/);
  assert.match(workflow, /data-layout-probe="pass"/);
  assert.match(workflow, /data-alert-window-ms="129600000"/);
});
