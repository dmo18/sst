import fs from 'node:fs';

const path = 'scripts/full-review-source-adapters.mjs';
let source = fs.readFileSync(path, 'utf8');
const before = `  const start = text.search(/\\bProduction Sandbox Services\\b/i);\n  const end = text.search(/\\bView history\\b/i);\n  const currentSection = start >= 0 ? text.slice(start, end > start ? end : start + 12000) : text.slice(0, 12000);\n  const explicit = /\\b(?:Production Systems? (?:Degraded|Unavailable)|Service (?:Outage|Disruption)|Major Outage|Degraded Performance|Partial Outage)\\b/i.exec(currentSection);`;
const after = `  const start = text.search(/\\bProduction Sandbox Services\\b/i);\n  const end = text.search(/\\bView history\\b/i);\n  const currentSection = start >= 0 ? text.slice(start, end > start ? end : start + 12000) : text.slice(0, 12000);\n  const legend = currentSection.search(/\\bOperational Major Outage Degraded Performance Maintenance Bulletin\\b/i);\n  const statusSection = legend > 0 ? currentSection.slice(0, legend) : currentSection;\n  const explicit = /\\b(?:Production Systems? (?:Degraded|Unavailable)|Service (?:Outage|Disruption)|Major Outage|Degraded Performance|Partial Outage)\\b/i.exec(statusSection);`;
if (!source.includes(before)) throw new Error('Missing PayPal status section parser');
source = source.replace(before, after).replace(
  "      message: clean(currentSection.slice(Math.max(0, explicit.index - 500), Math.min(currentSection.length, explicit.index + 1600))),",
  "      message: clean(statusSection.slice(Math.max(0, explicit.index - 500), Math.min(statusSection.length, explicit.index + 1600))),"
);
fs.writeFileSync(path, source);
console.log('Applied PayPal legend safety fix.');
