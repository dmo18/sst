import fs from 'node:fs';

const replaceOnce = (source, before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
};

const sourcePath = 'scripts/update-public-status.mjs';
let source = fs.readFileSync(sourcePath, 'utf8');
const oldMaintenance = `function maintenanceOnly(value) {
  return /\\b(scheduled maintenance|planned maintenance|maintenance window|deprecation|end of life|end of support)\\b/i.test(value)
    && !issueText(value);
}`;
const newMaintenance = `function plannedMaintenanceText(value) {
  return /\\b(this is a scheduled event|scheduled event|scheduled maintenance|planned maintenance|maintenance window|maintenance is currently in progress|will be performing (?:scheduled )?maintenance|deprecation|end of life|end of support)\\b/i.test(value);
}

function maintenanceEscalationText(value) {
  const text = String(value || '');
  if (/\\b(?:unplanned|emergency)\\s+(?:maintenance|work|change|event)\\b/i.test(text)) return true;
  if (/\\b(?:critical incident|major service outage|widespread outage|complete outage|incident declared|outage detected|unexpected (?:outage|impact|disruption))\\b/i.test(text)) return true;
  const responseState = /\\b(?:investigating|identified|monitoring)\\b/i.test(text);
  const currentImpact = /\\b(?:customers?|users?)\\s+(?:are|is)\\s+(?:currently\\s+)?(?:experiencing|unable|affected|impacted)\\b|\\b(?:currently|actively)\\s+(?:experiencing|impacting|affecting)\\b|\\b(?:service|services|requests?|traffic|connections?|api)\\s+(?:is|are)\\s+(?:currently\\s+)?(?:unavailable|degraded|failing|down|timing out)\\b|\\b(?:network performance issues?|service disruption|service degradation|elevated errors?|increased errors?|failed requests?|connection failures?)\\b/i.test(text);
  return responseState && currentImpact;
}

function maintenanceOnly(value) {
  return plannedMaintenanceText(value) && !maintenanceEscalationText(value);
}`;
source = replaceOnce(source, oldMaintenance, newMaintenance, 'maintenance classifier');
fs.writeFileSync(sourcePath, source);

const testPath = 'scripts/__tests__/update-public-status.test.js';
let tests = fs.readFileSync(testPath, 'utf8');
tests += `

test('scheduled event notices with conditional impact are not incidents', () => {
  const entries = [{
    title: 'THIS IS A SCHEDULED EVENT',
    note: 'Scheduled maintenance is currently in progress. Traffic might be re-routed, there is a possibility of slight latency, and interfaces may become temporarily unavailable.',
    status: 'in_progress',
    time: 'Thu, 31 Jul 2026 12:00:00 GMT'
  }];
  assert.equal(activeFeedEntries(entries, 336, Date.parse('2026-07-31T13:00:00Z')).length, 0);
});

test('planned maintenance stays suppressed when expected limitations sound severe', () => {
  const entries = [{
    title: 'Scheduled maintenance window',
    note: 'During this planned maintenance, users may be unable to create settings and connections could fail over. Service disruption is possible.',
    status: 'scheduled',
    time: 'Thu, 31 Jul 2026 12:00:00 GMT'
  }];
  assert.equal(activeFeedEntries(entries, 336, Date.parse('2026-07-31T13:00:00Z')).length, 0);
});

test('scheduled maintenance escalated to active customer impact remains an incident', () => {
  const entries = [{
    title: 'Scheduled maintenance update',
    note: 'Investigating: customers are currently experiencing connection failures during the maintenance window.',
    status: 'investigating',
    time: 'Thu, 31 Jul 2026 12:00:00 GMT'
  }];
  assert.equal(activeFeedEntries(entries, 336, Date.parse('2026-07-31T13:00:00Z')).length, 1);
});

test('emergency or critical maintenance events remain incidents', () => {
  const entries = [
    {
      title: 'Emergency maintenance due to unexpected outage',
      note: 'Service is currently unavailable while emergency work is performed.',
      status: 'identified',
      time: 'Thu, 31 Jul 2026 12:00:00 GMT'
    },
    {
      title: 'Scheduled maintenance escalated to critical incident',
      note: 'A major service outage has been declared.',
      status: 'critical',
      time: 'Thu, 31 Jul 2026 12:00:00 GMT'
    }
  ];
  assert.equal(activeFeedEntries(entries, 336, Date.parse('2026-07-31T13:00:00Z')).length, 2);
});
`;
fs.writeFileSync(testPath, tests);

const packagePath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (packageJson.version !== '2.3.6') throw new Error(`Expected version 2.3.6, found ${packageJson.version}`);
packageJson.version = '2.3.7';
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
