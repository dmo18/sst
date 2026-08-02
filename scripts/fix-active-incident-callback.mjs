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

fs.appendFileSync('src/styles/mobile-ops.css', `
@media (max-width: 900px) {
  .data-table-row > span:nth-child(2) small,
  .data-table-row > span:nth-child(3) small {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
    line-height: 1.32;
  }
  .data-table-row > span:nth-child(4),
  .data-table-row > span:nth-child(5),
  .data-table-row > span:nth-child(7) {
    grid-template-columns: 54px auto minmax(0, 1fr);
    align-items: baseline;
  }
  .data-table-row > span:nth-child(4)::before,
  .data-table-row > span:nth-child(5)::before,
  .data-table-row > span:nth-child(7)::before {
    color: #71839a;
    font-size: .52rem;
    font-weight: 760;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .data-table-row > span:nth-child(4)::before { content: 'Events'; }
  .data-table-row > span:nth-child(5)::before { content: 'Quality'; }
  .data-table-row > span:nth-child(7)::before { content: 'Observed'; }
}
`);

console.log('Replaced unsafe age-aware Array.filter callbacks and refined mobile provider cards.');
