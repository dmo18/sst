import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}

run('node', ['scripts/validate-providers.mjs']);
await import('./update-status.mjs');
run('npx', ['tsc', '--noEmit']);
run('npx', ['vite', 'build']);
