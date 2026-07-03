const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const basePath = path.join(root, 'config', 'providers.json');
const extraPath = path.join(root, 'config', 'extra-providers.json');

const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const extra = fs.existsSync(extraPath) ? JSON.parse(fs.readFileSync(extraPath, 'utf8')) : [];
const byId = new Map();

for (const provider of [...base, ...extra]) {
  if (!provider.id) throw new Error(`Provider missing id: ${provider.name || 'unknown'}`);
  byId.set(provider.id, provider);
}

const merged = [...byId.values()];
fs.writeFileSync(basePath, JSON.stringify(merged, null, 2) + '\n');
console.log(`Merged ${base.length} base providers and ${extra.length} extra providers into ${merged.length} total providers`);
