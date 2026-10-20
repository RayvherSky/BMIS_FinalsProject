// Explicit maintenance command: does not read .env or edit account documents.
const { mongo } = require('mongoose');

async function migrateAccountIndexes(db, { apply = false, rollback = false } = {}) {
  if (['admin', 'config', 'local'].includes(db.databaseName)) throw new Error('Choose an application database explicitly');
  const users = db.collection('users');
  const indexes = await users.listIndexes().toArray().catch(error => { if (error.code === 26) return []; throw error; });
  const legacy = indexes.find(index => index.name === 'email_1');
  if (legacy && (JSON.stringify(legacy.key) !== JSON.stringify({ email: 1 }) || !legacy.unique || legacy.partialFilterExpression || legacy.sparse)) {
    throw new Error('Unexpected email_1 index definition; inspect it before making changes');
  }
  if (rollback) {
    if (await users.countDocuments({ email: null }) > 1) {
      throw new Error('Rollback cannot restore the legacy email index while multiple accounts lack email; keep the forward schema and preserve those accounts');
    }
    if (apply) await users.createIndex({ email: 1 }, { name: 'email_1', unique: true });
    return { applied: apply, rollback: true, actions: ['Restore legacy unique email_1; retain additive indexes and all documents'] };
  }
  const actions = ['Ensure email_optional_unique (unique for string emails)', 'Ensure phone_normalized_unique (unique for normalized phone strings)'];
  if (legacy) actions.push('Drop verified legacy email_1 only after replacement indexes succeed');
  if (apply) {
    await users.createIndex({ email: 1 }, { name: 'email_optional_unique', unique: true, partialFilterExpression: { email: { $type: 'string' } } });
    await users.createIndex({ phoneNormalized: 1 }, { name: 'phone_normalized_unique', unique: true, partialFilterExpression: { phoneNormalized: { $type: 'string' } } });
    if (legacy) await users.dropIndex('email_1');
  }
  return { applied: apply, rollback: false, actions };
}

async function main() {
  const uri = process.env.BMIS_ACCOUNT_MIGRATION_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\/[^/]+\/[^?]+(?:\?.*)?$/.test(uri)) throw new Error('Set BMIS_ACCOUNT_MIGRATION_URI with an explicit database name; no .env defaults are used');
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--rollback'].includes(arg))) throw new Error('Supported arguments: --apply and --rollback');
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await migrateAccountIndexes(client.db(), { apply: args.includes('--apply'), rollback: args.includes('--rollback') }), null, 2));
  } finally { await client.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { migrateAccountIndexes };
