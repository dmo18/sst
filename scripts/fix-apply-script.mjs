import fs from 'node:fs';

const path = 'scripts/apply-stale-mobile-fix.mjs';
let text = fs.readFileSync(path, 'utf8');
const before = `  const html = \`<main>
    <h2>Active Incidents</h2>
    <h3>Secure Access service availability issue in Dubai</h3>
    <p>Identified - We are working with cloud partners and recommend alternate regions in Mumbai or Hyderabad.</p>
    <p>Apr 27 , 2026 - 17:47 UTC</p>
    <p>Update - We are continuing to investigate this issue.</p>
    <p>Mar 03 , 2026 - 19:55 UTC</p>
    <p>Investigating - Some users in Dubai may experience timeouts.</p>
    <p>Mar 02 , 2026 - 06:18 UTC</p>
  </main>\`;`;
const after = `  const html = '<main>' +
    '<h2>Active Incidents</h2>' +
    '<h3>Secure Access service availability issue in Dubai</h3>' +
    '<p>Identified - We are working with cloud partners and recommend alternate regions in Mumbai or Hyderabad.</p>' +
    '<p>Apr 27 , 2026 - 17:47 UTC</p>' +
    '<p>Update - We are continuing to investigate this issue.</p>' +
    '<p>Mar 03 , 2026 - 19:55 UTC</p>' +
    '<p>Investigating - Some users in Dubai may experience timeouts.</p>' +
    '<p>Mar 02 , 2026 - 06:18 UTC</p>' +
    '</main>';`;
if (!text.includes(before)) throw new Error('Embedded Cisco test fixture was not found');
text = text.replace(before, after);
fs.writeFileSync(path, text);
