import fs from 'node:fs';

const path = 'scripts/apply-deep-review-repairs.mjs';
let source = fs.readFileSync(path, 'utf8');
for (const expression of [
  'note',
  'affectedService',
  'incidents.length',
  "incidents.length === 1 ? '' : 's'",
  'scope',
  'problemComponents.length',
  "problemComponents.length === 1 ? '' : 's'",
  'names',
  'index',
  "String(index).padStart(2, '0')"
]) {
  source = source.replaceAll('${' + expression + '}', '\\${' + expression + '}');
}

source = source.replace(
  "  const subscribeAnchor = text.search(/\\\\bProduction Sandbox\\\\s+Subscribe\\\\b/i);\n  const servicesAnchor = text.search(/\\\\bProduction Sandbox Services\\\\b/i);\n  const start = subscribeAnchor >= 0 ? subscribeAnchor : servicesAnchor;",
  "  const subscribeAnchor = text.search(/\\\\bProduction Sandbox\\\\s+Subscribe\\\\b/i);\n  const productionAnchor = text.search(/\\\\bProduction Sandbox\\\\b/i);\n  const servicesAnchor = text.search(/\\\\bProduction Sandbox Services\\\\b/i);\n  const start = subscribeAnchor >= 0 ? subscribeAnchor : productionAnchor >= 0 ? productionAnchor : servicesAnchor;"
);

fs.writeFileSync(path, source);
console.log('Escaped generated-code interpolations and corrected PayPal production anchoring.');
