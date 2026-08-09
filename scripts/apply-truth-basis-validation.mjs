import fs from 'node:fs';
const path = 'scripts/update-status.mjs';
let source = fs.readFileSync(path, 'utf8');
const before = "['vendor-incident', 'confirmed-operational', 'observed-no-conclusion', 'last-known-official', 'limited-official', 'no-current-observation']";
const after = "['vendor-incident', 'vendor-component', 'observed-affected-no-detail', 'confirmed-operational', 'observed-no-conclusion', 'last-known-official', 'limited-official', 'no-current-observation']";
if (!source.includes(before)) throw new Error('Missing truth basis allowlist');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Updated truth basis validator.');
