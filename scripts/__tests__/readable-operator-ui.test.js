import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const SCOPE = '.app-frame[data-surface="operator"]';

function rules(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    if (!selector || selector.startsWith('@')) continue;
    // Split on commas that are not inside :is(...) or similar parentheses.
    const parts = [];
    let depth = 0;
    let current = '';
    for (const character of selector) {
      if (character === '(') depth += 1;
      if (character === ')') depth -= 1;
      if (character === ',' && depth === 0) { parts.push(current); current = ''; }
      else current += character;
    }
    parts.push(current);
    out.push({ selectors: parts.map(item => item.replace(/^@media[^{]*\{/, '').trim()).filter(Boolean), body: match[2] });
  }
  return out;
}

test('the readability layer cannot reach the wallboard', async () => {
  const [css, app, main] = await Promise.all([read('src/styles/readable.css'), read('src/App.tsx'), read('src/main.tsx')]);
  const all = rules(css);
  assert.ok(all.length > 80, 'readable.css should define the operator readability layer');
  for (const rule of all) {
    for (const selector of rule.selectors) assert.ok(selector.startsWith(SCOPE), `selector is not scoped to the operator surface: ${selector}`);
  }
  // No rule may name a wallboard class. (The header comment may mention it.)
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /wallboard/i);
  assert.match(app, /const surface = route\.wallboardMode \? 'wallboard' : consoleMode \? 'operator' : 'home';/);
  assert.match(app, /data-surface=\{surface\}/);
  assert.match(main, /import '\.\/styles\/readable\.css';/);
});

test('the readability layer never sets text below 14 pixels and uses no root-relative sizes', async () => {
  const css = await read('src/styles/readable.css');
  const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map(match => match[1].trim());
  assert.ok(sizes.length > 60);
  for (const size of sizes) {
    assert.doesNotMatch(size, /rem/, `root-relative size: ${size}`);
    const pixels = [...size.matchAll(/(\d+(?:\.\d+)?)px/g)].map(match => Number(match[1]));
    if (pixels.length) assert.ok(Math.min(...pixels) >= 14, `text smaller than 14px: ${size}`);
    else assert.match(size, /em$/, `unexpected size unit: ${size}`);
  }
});

test('the overview leads with problems and names every state in words', async () => {
  const source = await read('src/IssueConsole.tsx');
  assert.match(source, /Problems right now/);
  assert.match(source, /All services/);
  for (const word of ['Major outage', 'Degraded', 'Not confirmed', 'Working']) assert.ok(source.includes(`'${word}'`), `missing state word ${word}`);
  const overview = source.slice(source.indexOf('function OverviewView'), source.indexOf('function IncidentsView'));
  assert.ok(overview.indexOf('Problems right now') < overview.indexOf('All services'));
  assert.ok(overview.indexOf('All services') < overview.indexOf('<details className="readable-more">'));
  // The deployed release checks look for these markers.
  for (const marker of ['posture-panel', 'What deserves attention now', 'Live dependency table']) assert.ok(overview.includes(marker), `missing ${marker}`);
});

const HOME = '.app-frame[data-surface="home"]';

test('the plain status screen is the default and cannot reach the wallboard or the console', async () => {
  const [css, app, main, home] = await Promise.all([read('src/styles/status-home.css'), read('src/App.tsx'), read('src/main.tsx'), read('src/StatusHome.tsx')]);
  // Keyframe steps are not selectors.
  const all = rules(css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ''));
  assert.ok(all.length > 60);
  for (const rule of all) {
    for (const selector of rule.selectors) assert.ok(selector.startsWith(HOME), `selector is not scoped to the home surface: ${selector}`);
  }
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /wallboard|gradient|blur\(|text-transform:\s*uppercase/i);
  assert.match(main, /import '\.\/styles\/status-home\.css';/);
  assert.match(app, /surface === 'home'\s*\? <StatusHome /);
  assert.match(app, /searchParams\.get\('console'\) === 'full'/);
  // The wallboard branch is chosen first and is not affected by the console switch.
  assert.match(app, /\{route\.wallboardMode\s*\? <WallboardV2 /);
  assert.doesNotMatch(home, /Wallboard(V2)?['"]|wallboard-/);
});

test('the plain status screen never sets text below 14 pixels', async () => {
  const css = await read('src/styles/status-home.css');
  const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map(match => match[1].trim());
  assert.ok(sizes.length > 30);
  for (const size of sizes) {
    const pixels = /^(\d+(?:\.\d+)?)px$/.exec(size);
    assert.ok(pixels, `size must be in pixels: ${size}`);
    assert.ok(Number(pixels[1]) >= 14, `text smaller than 14px: ${size}`);
  }
});

test('the plain status screen leads with one verdict, then problems, then every service, and fails closed', async () => {
  const home = await read('src/StatusHome.tsx');
  const body = home.slice(home.indexOf('export function StatusHome'));
  const order = ['sh-verdict is-${summary.tone}', 'id="sh-major"', 'id="sh-degraded"', 'id="sh-unknown"', 'id="sh-all"'].map(marker => body.indexOf(marker));
  assert.ok(order.every(index => index > 0), 'every section exists');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'sections are in reading order');
  assert.match(home, /major: 'Major outage',\s*degraded: 'Degraded',\s*unknown: 'Not confirmed',\s*operational: 'Working'/);
  assert.match(home, /No service is shown as working until fresh information loads\./);
  assert.match(home, /This information may be out of date\./);
  assert.match(home, /const PAYLOAD_WARNING_MS = 20 \* 60 \* 1000;/);
});

test('vendor text reaches every screen in Eastern time', async () => {
  const model = await read('src/statusViewModel.ts');
  assert.match(model, /title: utcTextToEastern\(raw\.title, reference\)/);
  assert.match(model, /note: utcTextToEastern\(raw\.note, reference\)/);
  assert.match(model, /note: utcTextToEastern\(update\.note, update\.at \|\| reference\)/);
  assert.match(model, /title: utcTextToEastern\(item\.title, reference\), note: utcTextToEastern\(item\.note, reference\)/);
});

test('release checks open the technical console explicitly', async () => {
  const [release, experience] = await Promise.all([read('.github/workflows/refresh-pages.yml'), read('.github/workflows/product-experience.yml')]);
  assert.match(release, /--dump-dom "\$\{PAGE_URL\}\?console=full&smoke=/);
  for (const probe of ['experienceProbe', 'productDepthProbe', 'm365Probe', 'providerIdentityProbe'])
    assert.ok(experience.includes(`TARGET_URL="\${PAGE_URL}?console=full&${probe}=`), probe);
});

test('the compact wallboard column may shrink and a failed release still renews the keeper', async () => {
  const [glance, keeper] = await Promise.all([read('src/styles/wallboard-glance.css'), read('.github/workflows/refresh-continuity.yml')]);
  assert.match(glance, /\.compact-incident-board \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(keeper, /workflow_run\.conclusion == 'success' \|\| github\.event\.workflow_run\.conclusion == 'failure'/);
});
