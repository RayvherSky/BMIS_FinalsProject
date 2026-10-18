const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const { createTestDatabase } = require('./helpers/testDatabase');
const userSchema = require('../models/User').schema;

const expectedAccounts = [
  ['dispatch.admin@bmis.test', 'admin'],
  ['dispatch.employee1@bmis.test', 'employee'],
  ['dispatch.employee2@bmis.test', 'employee'],
  ['dispatch.user1@bmis.test', 'user'],
  ['dispatch.user2@bmis.test', 'user'],
];
let database, connection, users, tickets, credentialsPath;
before(async () => {
  database = await createTestDatabase('bmis_seed_accounts');
  credentialsPath = path.join(database.instanceInfo.dbPath, 'seed-test-credentials.json');
  connection = await mongoose.createConnection(database.getUri('bmis_seed_accounts')).asPromise();
  users = connection.model('User', userSchema);
  tickets = connection.collection('tickets');
});
after(async () => {
  if (connection) await connection.close();
  if (database) await database.stop();
});

async function runSeed() {
  // Execute the actual npm entry point against this test's temporary database.
  const windows = process.platform === 'win32';
  const command = windows ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const args = windows ? ['/d', '/s', '/c', 'npm run seed'] : ['run', 'seed'];
  const outputPath = path.join(database.instanceInfo.dbPath, 'seed-output.log');
  const output = await fs.open(outputPath, 'w');
  try {
    const child = spawn(command, args, { cwd: path.resolve(__dirname, '..'), windowsHide: true,
      env: { ...process.env, MONGODB_URI: database.getUri('bmis_seed_accounts'), BMIS_DEMO_CREDENTIALS_PATH: credentialsPath },
      stdio: ['ignore', output.fd, output.fd] });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    const stdout = await fs.readFile(outputPath, 'utf8');
    assert.equal(code, 0, `Seed failed: ${stdout}`);
    return stdout;
  } finally {
    await output.close();
    await fs.rm(outputPath, { force: true });
  }
}

test('npm run seed creates all 15 accounts and prints usable credentials grouped by role', async () => {
  const output = await runSeed();
  const records = await users.find({}).lean();
  assert.equal(records.length, 15, 'the seed includes the existing ten plus the five new accounts');
  assert.deepEqual(records.reduce((counts, account) => ({ ...counts, [account.role]: (counts[account.role] || 0) + 1 }), {}),
    { admin: 3, user: 10, employee: 2 });
  assert.ok(output.includes('Admin Accounts:') && output.includes('Employee Accounts:') && output.includes('User Accounts:'));
  const sections = { admin: output.split('Admin Accounts:')[1].split('Employee Accounts:')[0],
    employee: output.split('Employee Accounts:')[1].split('User Accounts:')[0], user: output.split('User Accounts:')[1] };
  const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
  for (const [email, role] of expectedAccounts) {
    const account = await users.findOne({ email });
    const login = credentials.accounts.find(entry => entry.email === email);
    assert.equal(account.role, role);
    assert.ok(login?.password, `saved password for ${email}`);
    assert.ok(await account.comparePassword(login.password), `printed password authenticates ${email}`);
    assert.ok(sections[role].includes(`${email} / ${login.password}`), `${email} appears under its role with its actual password`);
  }
  assert.ok(output.includes('maria.santos@email.com / Password123!'));
  assert.ok(output.includes('ana.reyes@email.com / Password123!'));
  assert.doesNotMatch(output, /All passwords: Password123!/);
  assert.ok((await tickets.countDocuments({ status: { $in: ['Resolved', 'Dismissed'] } })) >= 20);
  const ownerIds = new Set(records.map(record => String(record._id)));
  for (const ticket of await tickets.find({}).toArray()) assert.ok(ownerIds.has(String(ticket.submittedBy)));
});

test('reseed recreates the new account set without duplicating tickets or changing saved dispatch passwords', async () => {
  await runSeed();
  assert.equal(await users.countDocuments(), 15);
  const savedCredentials = await fs.readFile(credentialsPath, 'utf8');
  const ticketCount = await tickets.countDocuments();
  const previous = await users.findOne({ email: 'dispatch.employee1@bmis.test' });
  await users.updateOne({ _id: previous._id }, { $set: { role: 'user', isActive: false } });
  await tickets.insertOne({ title: 'Discarded by explicit reseed' });
  const output = await runSeed();
  assert.equal(await users.countDocuments(), 15);
  assert.equal(await tickets.countDocuments(), ticketCount);
  assert.equal(await fs.readFile(credentialsPath, 'utf8'), savedCredentials);
  for (const entry of JSON.parse(savedCredentials).accounts) {
    const account = await users.findOne({ email: entry.email });
    assert.equal(account.role, entry.role);
    assert.equal(account.isActive, true);
    assert.ok(await account.comparePassword(entry.password));
    assert.ok(output.includes(`${entry.email} / ${entry.password}`));
  }
  assert.notEqual(String((await users.findOne({ email: previous.email }))._id), String(previous._id));
});
