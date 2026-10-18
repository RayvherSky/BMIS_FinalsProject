const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const User = require('../models/User');
const { withAccountLock } = require('../utils/accountLock');

const DEFAULT_CREDENTIALS_PATH = path.join(__dirname, '..', '.local-data', 'demo-accounts-2026-10-19.json');
const DEMO_ACCOUNTS = [
  { firstName: 'Demo', lastName: 'Administrator', email: 'dispatch.admin@bmis.test', role: 'admin' },
  { firstName: 'Alex', lastName: 'Employee', email: 'dispatch.employee1@bmis.test', role: 'employee' },
  { firstName: 'Sam', lastName: 'Employee', email: 'dispatch.employee2@bmis.test', role: 'employee' },
  { firstName: 'Jamie', lastName: 'User', email: 'dispatch.user1@bmis.test', role: 'user' },
  { firstName: 'Taylor', lastName: 'User', email: 'dispatch.user2@bmis.test', role: 'user' },
];
const keyFor = email => `bmis-three-role-demo-2026-10-19:${email}`;

async function writeCredentials(file, document) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(document, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function provisionAccounts({ UserModel = User, credentialsPath = DEFAULT_CREDENTIALS_PATH } = {}) {
  return withAccountLock('demo-provisioning', async () => {
    const existing = await UserModel.find({ email: { $in: DEMO_ACCOUNTS.map(account => account.email) } }).select('+demoProvisioningKey');
    const byEmail = new Map(existing.map(account => [account.email, account]));
    // Preflight the entire set before any database or credential mutation.
    for (const account of existing) {
      if (account.demoProvisioningKey !== keyFor(account.email)) throw new Error(`Unrelated email collision: ${account.email}; no accounts changed`);
    }
    let credentials;
    try {
      credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
      if (credentials.version !== 1 || !Array.isArray(credentials.accounts)) throw new Error('Invalid credentials file');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      credentials = { version: 1, createdAt: new Date().toISOString(), accounts: [] };
    }
    const saved = new Map(credentials.accounts.map(account => [account.email, account]));
    const missing = DEMO_ACCOUNTS.filter(account => !byEmail.has(account.email));
    let changed = false;
    for (const account of DEMO_ACCOUNTS) {
      if (!saved.has(account.email)) {
        const entry = { ...account, password: byEmail.has(account.email) ? null : `${crypto.randomBytes(18).toString('base64url')}!aA9` };
        credentials.accounts.push(entry);
        saved.set(account.email, entry);
        changed = true;
      }
      if (!byEmail.has(account.email) && !saved.get(account.email).password) {
        saved.get(account.email).password = `${crypto.randomBytes(18).toString('base64url')}!aA9`;
        changed = true;
      }
    }
    // Persist generated passwords before creating accounts so an interrupted
    // run can resume without losing a newly created account's first password.
    if (changed) await writeCredentials(credentialsPath, credentials);
    for (const account of missing) {
      await UserModel.create({ ...account, password: saved.get(account.email).password, isActive: true, demoProvisioningKey: keyFor(account.email) });
    }
    return { created: missing.length, existing: existing.length, credentialsPath, accounts: DEMO_ACCOUNTS.map(account => ({ email: account.email, role: account.role })) };
  });
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const result = await provisionAccounts();
    console.log(`Created ${result.created}; already provisioned ${result.existing}. Credentials: ${result.credentialsPath}`);
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { provisionAccounts, DEMO_ACCOUNTS, DEFAULT_CREDENTIALS_PATH };
