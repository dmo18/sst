import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('browser collection feasibility record preserves the static canonical boundary', async () => {
  const [record, overlay, collector, vite, scheduler] = await Promise.all([
    read('docs/browser-collection-feasibility.md'),
    read('src/liveStatusTruth.ts'),
    read('scripts/update-public-status.mjs'),
    read('vite.config.ts'),
    read('.github/workflows/refresh-pages.yml')
  ]);

  assert.match(record, /80-provider catalog/);
  assert.match(record, /\| 49 \|/);
  assert.match(record, /\| 24 \|/);
  assert.match(record, /\| 7 \|/);
  assert.match(record, /scheduling can \*\*guarantee\*\* a canonical update within five minutes/);
  assert.match(record, /No VM or Agent Deck service participates in SST production/);
  assert.match(overlay, /source_type === 'statuspage-json'/);
  assert.match(overlay, /mode: 'cors'/);
  assert.match(overlay, /credentials: 'omit'/);
  assert.match(collector, /enrichProviderHistory/);
  assert.match(collector, /buildCollectionIntelligence/);
  assert.match(vite, /provider\.sourceType === 'statuspage'/);
  assert.match(scheduler, /cron: "\*\/5 \* \* \* \*"/);
});
