// Cross-platform equivalent of BMIS_FRONTEND_ONLY=1 playwright test.
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
  stdio: 'inherit',
  env: { ...process.env, BMIS_FRONTEND_ONLY: '1' },
});
child.on('error', (error) => { console.error(error.message); process.exit(1); });
child.on('exit', (code) => process.exit(code ?? 1));
