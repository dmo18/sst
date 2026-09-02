import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusPathFromDeployment } from './deployed-status.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputDir = path.resolve(process.argv[2] || path.join(root, 'dist'));
const versionFile = path.join(root, 'public', 'deploy-version.txt');
const source = path.join(root, 'public', 'status.json');
const { statusPath } = statusPathFromDeployment(fs.readFileSync(versionFile, 'utf8'));

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(source, path.join(outputDir, statusPath));
console.log(`Published immutable deployment payload ${statusPath}.`);
