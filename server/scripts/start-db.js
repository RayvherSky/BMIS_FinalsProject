// Optional local MongoDB launcher for machines without a MongoDB service.
// Despite the library name, this instance uses persistent on-disk storage.
const { MongoMemoryServer } = require('mongodb-memory-server');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const dbPath = path.join(__dirname, '..', '.local-data', 'mongodb');
  await mkdir(dbPath, { recursive: true });
  const database = new MongoMemoryServer({
    binary: { version: '8.2.6' },
    instance: { port: 27017, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
  });
  // Keep the configured port; fail clearly if another MongoDB already uses it.
  await database.start(true);
  console.log('Local MongoDB is ready at mongodb://127.0.0.1:27017/bmis');
  console.log(`Data is retained in ${dbPath}. Keep this terminal running.`);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await database.stop({ doCleanup: false });
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error) => {
  console.error(`Unable to start local MongoDB: ${error.message}`);
  process.exit(1);
});
