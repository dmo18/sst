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
    out.push({ selectors: selector.split(',').map(item => item.replace(/^@media[^{]*\{/, '').trim()).filter(Boolean), body: match[2] });
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
  assert.match(app, /data-surface=\{route\.wallboardMode \? 'wallboard' : 'operator'\}/);
  assert.match(main, /import '\.\/styles\/readable\.css';/);
});

test('the readability layer never sets text below 15 pixels and uses no root-relative sizes', async () => {
  const css = await read('src/styles/readable.css');
  const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map(match => match[1].trim());
  assert.ok(sizes.length > 60);
  for (const size of sizes) {
    assert.doesNotMatch(size, /rem/, `root-relative size: ${size}`);
    const pixels = [...size.matchAll(/(\d+(?:\.\d+)?)px/g)].map(match => Number(match[1]));
    if (pixels.length) assert.ok(Math.min(...pixels) >= 15, `text smaller than 15px: ${size}`);
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
