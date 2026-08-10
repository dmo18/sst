import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const roots = ['src', 'scripts'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs']);
const excluded = new Set(['legacy-update-status.mjs', 'public-source-adapter-implementation.mjs']);
const definitionCensusExcluded = new Set(['source-quality.mjs']);
const errors = [];
const activeSources = [];

function filesUnder(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...filesUnder(target));
    else output.push(target);
  }
  return output;
}

for (const relativeRoot of roots) {
  for (const file of filesUnder(path.join(root, relativeRoot))) {
    if (!extensions.has(path.extname(file)) || excluded.has(path.basename(file))) continue;
    const relative = path.relative(root, file);
    const text = fs.readFileSync(file, 'utf8');
    if (!relative.includes('__tests__') && !definitionCensusExcluded.has(path.basename(file))) activeSources.push({ relative, text });
    text.split(/\r?\n/).forEach((line, index) => {
      if (/[ \t]+$/.test(line)) errors.push(`${relative}:${index + 1}: trailing whitespace`);
    });
    if (!relative.includes('__tests__') && /\beval\s*\(|\bnew\s+Function\s*\(/.test(text)) errors.push(`${relative}: dynamic code execution is forbidden`);
  }
}

for (const [policy, pattern] of [
  ['effectiveIncidentTime', /export function effectiveIncidentTime\b/g],
  ['componentStatusDisposition', /export function componentStatusDisposition\b/g],
  ['regionScopeRelevant', /export function regionScopeRelevant\b/g]
]) {
  const definitions = activeSources.flatMap(source => [...source.text.matchAll(pattern)].map(() => source.relative));
  if (definitions.length !== 1) errors.push(`${policy}: expected one canonical exported definition, found ${definitions.length} (${definitions.join(', ') || 'none'})`);
}

const app = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8');
for (const forbidden of ['RequestOwnership', 'payloadValidationErrors', 'wirePayloadValidationErrors', 'fetch(']) {
  if (app.includes(forbidden)) errors.push(`src/App.tsx: polling concern leaked back into composition layer: ${forbidden}`);
}
if (!/usePayloadPoller/.test(app)) errors.push('src/App.tsx: must use the shared payload poller hook');

if (errors.length) {
  console.error('Source quality validation failed.');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Source quality validation passed.');
