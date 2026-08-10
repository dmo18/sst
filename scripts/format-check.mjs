import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.yml', '.yaml', '.css']);
const ignoredNames = new Set(['legacy-update-status.mjs', 'public-source-repairs-legacy.mjs']);

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(entry.name)) scan(target);
      continue;
    }
    if (!textExtensions.has(path.extname(target)) || ignoredNames.has(entry.name)) continue;
    const relative = path.relative(root, target);
    const text = fs.readFileSync(target, 'utf8');
    text.split(/\r?\n/).forEach((line, index) => {
      if (/[ \t]+$/.test(line)) errors.push(`${relative}:${index + 1}: trailing whitespace`);
      if (/\.ya?ml$/.test(target) && /^\t+/.test(line)) errors.push(`${relative}:${index + 1}: YAML indentation must use spaces`);
    });
    if (path.extname(target) === '.json') {
      try { JSON.parse(text); } catch (error) { errors.push(`${relative}: invalid JSON: ${error.message}`); }
    }
  }
}

for (const directory of ['src', 'scripts', '.github']) scan(path.join(root, directory));

if (errors.length) {
  console.error('Formatting hygiene validation failed.');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Formatting hygiene validation passed.');
