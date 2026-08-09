import fs from 'node:fs';

const path = 'scripts/apply-deep-review-repairs.mjs';
let source = fs.readFileSync(path, 'utf8');
for (const expression of [
  'note',
  'affectedService',
  'incidents.length',
  'scope',
  'problemComponents.length',
  'names',
  'index',
  "String(index).padStart(2, '0')"
]) {
  source = source.replaceAll('${' + expression + '}', '\\${' + expression + '}');
}
fs.writeFileSync(path, source);
console.log('Escaped generated-code interpolations in deep review patch.');
