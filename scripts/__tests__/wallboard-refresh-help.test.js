import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('wallboard browser refresh cadence is URL-controlled with a one-minute safe default', async () => {
  const route = await read('src/wallboardRoute.ts');
  const app = await read('src/App.tsx');

  assert.match(route, /DEFAULT_BROWSER_REFRESH_MS = MINUTE_MS/);
  assert.match(route, /MIN_BROWSER_REFRESH_MS = 15 \* SECOND_MS/);
  assert.match(route, /MAX_BROWSER_REFRESH_MS = HOUR_MS/);
  assert.match(route, /parseRefreshIntervalMs/);
  assert.match(route, /params\.get\('refresh'\)/);
  assert.match(app, /route\.wallboardMode \? route\.refreshIntervalMs : DEFAULT_BROWSER_REFRESH_MS/);
  assert.match(app, /window\.setInterval\([\s\S]*browserRefreshMs\)/);
  assert.match(app, /\[browserRefreshMs, refresh\]/);
});

test('deployed online help and repository docs explain refresh semantics', async () => {
  const help = await read('public/help.html');
  const readme = await read('README.md');
  const options = await read('docs/wallboard-url-options.md');

  for (const source of [help, readme, options]) {
    assert.match(source, /refresh=1m/);
    assert.match(source, /15 seconds/i);
    assert.match(source, /one hour|1 hour/i);
    assert.match(source, /Yodeck/i);
  }

  assert.match(help, /Browser[\s\S]*most recent successful browser payload check/i);
  assert.match(options, /GitHub Actions collection cadence/);
  assert.match(readme, /deployed online help/i);
  assert.doesNotMatch(help, /<script\b/i);
});
