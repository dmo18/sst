import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('all third-party GitHub Actions are pinned to immutable commits', async () => {
  const workflowDir = new URL('.github/workflows/', root);
  const files = (await readdir(workflowDir)).filter(name => /\.ya?ml$/i.test(name));
  assert.ok(files.length > 0);

  for (const file of files) {
    const text = await read(`.github/workflows/${file}`);
    for (const match of text.matchAll(/\buses:\s*([^\s#]+)/g)) {
      const reference = match[1];
      if (reference.startsWith('./')) continue;
      assert.match(reference, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+@[0-9a-f]{40}$/, `${file} has a moving action reference: ${reference}`);
    }
  }
});

test('checkout credentials are never persisted into repository worktrees', async () => {
  const workflowDir = new URL('.github/workflows/', root);
  const files = (await readdir(workflowDir)).filter(name => /\.ya?ml$/i.test(name));

  for (const file of files) {
    const text = await read(`.github/workflows/${file}`);
    const checkouts = [...text.matchAll(/- (?:name:[^\n]*\n\s*)?uses:\s*actions\/checkout@[0-9a-f]{40}[^\n]*\n\s*with:\s*\n\s*persist-credentials:\s*false/g)];
    const checkoutCount = [...text.matchAll(/uses:\s*actions\/checkout@[0-9a-f]{40}/g)].length;
    assert.equal(checkouts.length, checkoutCount, `${file} must set persist-credentials: false on every checkout`);
  }
});

test('vendor collection runs without GitHub tokens or deployment permissions', async () => {
  const workflow = await read('.github/workflows/refresh-pages.yml');
  const buildStart = workflow.indexOf('  build:');
  const deployStart = workflow.indexOf('  deploy:');
  assert.ok(buildStart >= 0 && deployStart > buildStart);
  const buildJob = workflow.slice(buildStart, deployStart);

  assert.match(buildJob, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(buildJob, /pages:\s*write|id-token:\s*write|statuses:\s*write|actions:\s*write/);
  assert.match(buildJob, /env -u GITHUB_TOKEN -u GH_TOKEN npm run update-status/);

  const renderer = await read('scripts/public-source-adapter-implementation.mjs');
  assert.doesNotMatch(renderer, /--no-sandbox/);
  assert.match(renderer, /--user-data-dir=\$\{profileDir\}/);
  assert.match(renderer, /fs\.rmSync\(profileDir, \{ recursive: true, force: true \}\)/);
});

test('CI audits the complete dependency graph and Dependabot owns updates', async () => {
  for (const file of ['.github/workflows/test.yml', '.github/workflows/refresh-pages.yml']) {
    const workflow = await read(file);
    assert.match(workflow, /npm audit --audit-level=high/);
    assert.doesNotMatch(workflow, /npm audit[^\n]*--omit=dev/);
  }

  const dependabot = await read('.github/dependabot.yml');
  assert.match(dependabot, /package-ecosystem:\s*npm/);
  assert.match(dependabot, /package-ecosystem:\s*github-actions/);
});

test('public browser runtime remains locally bundled', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:\/\//i);

  const pkg = JSON.parse(await read('package.json'));
  const declared = Object.keys(pkg.dependencies || {}).sort();
  assert.deepEqual(declared, ['@vitejs/plugin-react', 'react', 'react-dom']);
});
