import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = path.join(root, 'public');
const outputPath = path.join(publicDir, 'deploy-version.txt');
const commit = process.env.GITHUB_SHA || 'local';
const runId = process.env.GITHUB_RUN_ID || 'local';
const generatedAt = new Date().toISOString();
const statusPath = `status-${runId}.json`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(outputPath, [
  `commit: ${commit}`,
  `run_id: ${runId}`,
  `generated_at: ${generatedAt}`,
  `status_path: ${statusPath}`,
  ''
].join('\n'), 'utf8');

console.log(`Generated deploy-version.txt for commit ${commit} run ${runId}.`);
