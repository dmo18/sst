import fs from 'node:fs';
import path from 'node:path';
import { verifyReleaseContract } from './release-contract.mjs';

const target = path.resolve(process.argv[2] || 'public/status.json');
const payload = JSON.parse(fs.readFileSync(target, 'utf8'));
const result = verifyReleaseContract(payload);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `description=${result.description}\nstate=${result.state}\n`);
}

console.log(`V3 deployment contract passed: ${result.description}; source status ${result.state}; ${payload.collection.origin_count} origins; ${payload.collection.request_count} requests; p95 ${payload.collection.p95_request_ms}ms.`);
