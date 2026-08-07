import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parseStatuspageSummary } from '../structured-source-adapters.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

test('rendered vendor pages never block the concurrent collector event loop', () => {
  const renderer = fs.readFileSync(path.join(root, 'scripts', 'public-source-repairs.mjs'), 'utf8');
  const collector = fs.readFileSync(path.join(root, 'scripts', 'update-public-status.mjs'), 'utf8');

  assert.doesNotMatch(renderer, /\bspawnSync\b/);
  assert.match(renderer, /export async function renderPublicPage\(source\)/);
  assert.match(collector, /await renderPublicPage\(source\)/);
});

test('explicit current Statuspage health wins over stale unresolved history', () => {
  const fixture = {
    page: { id: 'example', name: 'Example', url: 'https://status.example.com/' },
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [{ id: 'api', name: 'US API', status: 'operational' }],
    incidents: [
      {
        id: 'stale-record',
        name: 'Old US API degradation',
        status: 'monitoring',
        impact: 'minor',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T01:00:00Z',
        components: [{ id: 'api', name: 'US API' }],
        incident_updates: [
          {
            status: 'monitoring',
            body: 'US API recovery was being monitored.',
            created_at: '2026-01-01T01:00:00Z'
          }
        ]
      }
    ],
    scheduled_maintenances: []
  };

  const result = parseStatuspageSummary(JSON.stringify(fixture), { id: 'example', name: 'Example' }, { regionScope: 'us' });

  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'All Systems Operational');
});

test('browser maintenance filtering reconciles the summary it exposes', () => {
  const app = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8');

  assert.match(app, /maintenance_count:\s*emergencyMaintenance\.length/);
  assert.match(app, /ongoing_maintenance_count:\s*emergencyMaintenance\.filter\(item => item\.status === 'in_progress'\)\.length/);
});
