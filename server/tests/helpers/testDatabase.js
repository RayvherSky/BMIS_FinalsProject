const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { mongo } = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// The optional standalone instance is reserved for isolated tests. Never fall
// back to server/.env or permit a caller to select a normal database or port.
async function createTestDatabase(name) {
  const configuredUri = process.env.BMIS_TEST_MONGO_URI;
  if (!configuredUri) return MongoMemoryServer.create({ binary: { version: '8.2.6' } });
  const match = /^mongodb:\/\/(127\.0\.0\.1|localhost):48174\/(bmis_update1_test_[a-zA-Z0-9_]+)$/.exec(configuredUri);
  assert.ok(match, 'BMIS_TEST_MONGO_URI must use loopback port 48174 and a bmis_update1_test_ database prefix');
  assert.match(name, /^[a-zA-Z][a-zA-Z0-9_]*$/, 'A safe test-suite name is required');
  const databaseName = `${match[2]}_${name}_${randomBytes(4).toString('hex')}`;
  assert.ok(Buffer.byteLength(databaseName) < 64, 'Isolated database name is too long');
  const uri = `mongodb://${match[1]}:48174/${databaseName}`;
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  const localData = path.resolve(__dirname, '../../.local-data');
  let filesPath;
  try {
    await client.connect();
    await client.db(databaseName).command({ ping: 1 });
    await fs.mkdir(localData, { recursive: true });
    filesPath = await fs.mkdtemp(path.join(localData, 'update1-test-files-'));
  } catch (error) {
    await client.close();
    throw error;
  }
  let stopping;
  return {
    instanceInfo: { dbPath: filesPath },
    getUri(requestedName = name) {
      assert.equal(requestedName, name, 'A test instance can only access its own database');
      return uri;
    },
    stop() {
      stopping ||= (async () => {
        try {
          // The URI/name are immutable and were generated only after validation.
          await client.db(databaseName).dropDatabase();
        } finally {
          await client.close();
          const resolvedPath = await fs.realpath(filesPath);
          const resolvedRoot = await fs.realpath(localData);
          assert.equal(path.dirname(resolvedPath), resolvedRoot, 'Cleanup must stay inside test storage');
          assert.ok(path.basename(resolvedPath).startsWith('update1-test-files-'));
          await fs.rm(resolvedPath, { recursive: true, force: true });
        }
      })();
      return stopping;
    },
  };
}

module.exports = { createTestDatabase };
