import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function write(relative, value) {
  fs.writeFileSync(path.join(root, relative), value);
}

function replaceOnce(value, before, after, label) {
  if (value.includes(after)) return value;
  const count = value.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  return value.replace(before, after);
}

let details = read('scripts/incident-detail-repairs.mjs');
details = replaceOnce(
  details,
  'united states|u\\.s\\.|usa|north america|americas',
  'united states|u\\.s\\.|usa|us|north america|americas',
  'standalone US region token'
);
details = replaceOnce(
  details,
  'report issue|this is a scheduled event)$/i.test(title);',
  'report issue|this is a scheduled event|[^\\n]{2,180} public status(?: page)? reports an active issue)$/i.test(title);',
  'generic generated status title'
);
write('scripts/incident-detail-repairs.mjs', details);

let generator = read('scripts/update-public-status.mjs');
generator = replaceOnce(
  generator,
  "  if (conclusion.kind === 'issue') {\n    const incident = makeIncident(",
  "  if (conclusion.kind === 'issue') {\n    if (isGenericIncidentTitle(conclusion.title)) {\n      return providerStatus(\n        provider,\n        source,\n        'Limited official source',\n        'blue',\n        false,\n        'The page reported an issue state without a specific incident title or details, so no incident was published.',\n        logs,\n        [],\n        'limited'\n      );\n    }\n    const incident = makeIncident(",
  'generic issue publication guard'
);
write('scripts/update-public-status.mjs', generator);

let tests = read('scripts/__tests__/update-public-status.test.js');
tests = replaceOnce(
  tests,
  "assert.equal(isGenericIncidentTitle('Cloudflare public status page reports an active issue'), false);",
  "assert.equal(isGenericIncidentTitle('Cloudflare public status page reports an active issue'), true);",
  'generic provider status assertion'
);
write('scripts/__tests__/update-public-status.test.js', tests);

console.log('Applied final generic incident and US scope guards.');
