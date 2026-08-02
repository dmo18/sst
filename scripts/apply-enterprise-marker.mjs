import fs from 'node:fs';

const file = 'src/IssueConsole.tsx';
const source = fs.readFileSync(file, 'utf8');
const marker = 'Technician briefing. Provider diagnostics and evidence.';
if (!source.includes(marker)) throw new Error('Expected render compatibility marker was not found');
fs.writeFileSync(file, source.replace(marker, `Operations command center. ${marker}`));
