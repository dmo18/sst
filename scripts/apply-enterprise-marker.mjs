import fs from 'node:fs';

const consoleFile = 'src/IssueConsole.tsx';
const consoleSource = fs.readFileSync(consoleFile, 'utf8');
const marker = 'Technician briefing. Provider diagnostics and evidence.';
if (!consoleSource.includes(marker)) throw new Error('Expected render compatibility marker was not found');
fs.writeFileSync(consoleFile, consoleSource.replace(marker, `Operations command center. ${marker}`));

const testFile = 'src/__tests__/liveTelemetry.test.ts';
const testSource = fs.readFileSync(testFile, 'utf8');
fs.writeFileSync(testFile, testSource.replace("from '../liveTelemetry';", "from '../liveTelemetry.ts';"));
