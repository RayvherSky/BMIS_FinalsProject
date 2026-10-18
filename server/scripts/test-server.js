// Acceptance tests always use a fresh, temporary MongoDB, never server/.env's database.
const { createTestDatabase } = require('../tests/helpers/testDatabase');
const { spawn } = require('node:child_process');
const path = require('node:path');

async function main() {
  const database = await createTestDatabase('bmis_acceptance');
  const cwd = path.join(__dirname, '..');
  const env = {
    ...process.env,
    MONGODB_URI: database.getUri('bmis_acceptance'),
    BMIS_DEMO_CREDENTIALS_PATH: path.join(database.instanceInfo.dbPath, 'demo-accounts.json'),
    JWT_SECRET: 'bmis-isolated-acceptance-tests',
    PORT: '5001',
  };
  const seed = spawn(process.execPath, ['seeders/seed.js'], { cwd, env, stdio: 'inherit' });
  const seedCode = await new Promise((resolve, reject) => {
    seed.once('error', reject);
    seed.once('exit', resolve);
  });
  if (seedCode !== 0) {
    await database.stop();
    throw new Error('Acceptance database seeding failed');
  }
  const server = spawn(process.execPath, ['server.js'], { cwd, env, stdio: 'inherit' });
  const stop = async () => {
    server.kill();
    await database.stop();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  server.once('error', async (error) => {
    console.error(error.message);
    await database.stop();
    process.exit(1);
  });
  server.once('exit', async (code) => {
    await database.stop();
    process.exit(code || 0);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
