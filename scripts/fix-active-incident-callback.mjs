import fs from 'node:fs';

for (const path of ['scripts/update-status.mjs', 'scripts/update-public-status.mjs']) {
  const before = fs.readFileSync(path, 'utf8');
  const after = before.replaceAll('.filter(activeIncident)', '.filter(item => activeIncident(item))');
  if (after === before) throw new Error(`No direct activeIncident filter callback found in ${path}`);
  fs.writeFileSync(path, after);
}

const testPath = 'scripts/__tests__/incident-freshness.test.js';
let tests = fs.readFileSync(testPath, 'utf8');
tests = tests.replace("import assert from 'node:assert/strict';\n", "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n");
tests += `

test('age-aware activeIncident is never passed directly to Array.filter', () => {
  for (const path of ['scripts/update-status.mjs', 'scripts/update-public-status.mjs']) {
    const source = fs.readFileSync(path, 'utf8');
    assert.equal(source.includes('.filter(activeIncident)'), false, path);
  }
});
`;
fs.writeFileSync(testPath, tests);
console.log('Replaced unsafe age-aware Array.filter callbacks.');
